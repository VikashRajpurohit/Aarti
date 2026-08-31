import { supabase } from '../config/supabase';
import {
  getPresetRange,
  getDateRangeList,
  toKolkataStartOfDayISO,
  toKolkataEndOfDayISO,
  getKolkataDateString,
} from '../utils/reportDates';

// PostgREST silently caps results at 1000 rows. Report queries aggregate raw
// rows, so without an explicit limit totals would silently under-count as data
// grows. Set a high explicit cap on every report query.
const REPORT_ROW_LIMIT = 10000;

const toNumber = (value) => {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMaterialList = (materials, entries) => {
  const ordered = [];
  const seen = new Set();

  materials.forEach((material) => {
    if (!material?.id) return;
    ordered.push({ key: material.id, name: material.name || 'Unknown' });
    seen.add(material.id);
  });

  entries.forEach((entry) => {
    (entry?.materials || []).forEach((item) => {
      const key = item?.material_id || item?.name;
      if (!key || seen.has(key)) return;
      ordered.push({ key, name: item?.name || 'Unknown' });
      seen.add(key);
    });
  });

  return ordered;
};

const buildRawMaterialSummary = (entries, materials, dateList) => {
  const materialList = buildMaterialList(materials, entries);
  const rangeTotals = {};
  const dayTotals = {};

  dateList.forEach((date) => {
    dayTotals[date] = {};
    materialList.forEach((material) => {
      dayTotals[date][material.key] = 0;
    });
  });

  materialList.forEach((material) => {
    rangeTotals[material.key] = 0;
  });

  entries.forEach((entry) => {
    const dateKey = entry?.shift_date;
    if (!dateKey) return;
    if (!dayTotals[dateKey]) {
      dayTotals[dateKey] = {};
      materialList.forEach((material) => {
        dayTotals[dateKey][material.key] = 0;
      });
    }

    (entry?.materials || []).forEach((item) => {
      const key = item?.material_id || item?.name;
      if (!key) return;
      const quantity = toNumber(item?.quantity);
      if (!Number.isFinite(dayTotals[dateKey][key])) {
        dayTotals[dateKey][key] = 0;
      }
      dayTotals[dateKey][key] += quantity;
      if (!Number.isFinite(rangeTotals[key])) {
        rangeTotals[key] = 0;
      }
      rangeTotals[key] += quantity;
    });
  });

  const totals = materialList.map((material) => ({
    key: material.key,
    name: material.name,
    quantity: rangeTotals[material.key] || 0,
  }));

  const byDay = dateList.map((date) => ({
    date,
    materials: materialList.map((material) => ({
      key: material.key,
      name: material.name,
      quantity: dayTotals[date]?.[material.key] || 0,
    })),
  }));

  return { totals, byDay };
};

const emptyProductionTotals = () => ({
  stretch: { units: 0, weight: 0 },
  bubble: { units: 0, weight: 0 },
  pouch: { pieces: 0 },
  baby: { units: 0 },
});

const buildProductionSummary = (shifts, dateList) => {
  const rangeTotals = emptyProductionTotals();
  const dayShiftTotals = emptyProductionTotals();
  const nightShiftTotals = emptyProductionTotals();
  const dayTotals = {};

  dateList.forEach((date) => {
    dayTotals[date] = emptyProductionTotals();
  });

  shifts.forEach((shift) => {
    const dateKey = shift?.shift_date;
    if (!dateKey) return;
    if (!dayTotals[dateKey]) {
      dayTotals[dateKey] = emptyProductionTotals();
    }

    const shiftBucket = shift?.shift_type === 'day' ? dayShiftTotals : nightShiftTotals;

    (shift?.production_outputs || []).forEach((output) => {
      const category = output?.category;
      if (!category) return;

      if (category === 'stretch' || category === 'bubble') {
        const units = toNumber(output?.output_count);
        const weight = output?.total_weight !== null && output?.total_weight !== undefined
          ? toNumber(output?.total_weight)
          : units * toNumber(output?.avg_weight);
        dayTotals[dateKey][category].units += units;
        dayTotals[dateKey][category].weight += weight;
        rangeTotals[category].units += units;
        rangeTotals[category].weight += weight;
        shiftBucket[category].units += units;
        shiftBucket[category].weight += weight;
        return;
      }

      if (category === 'pouch') {
        const pieces = toNumber(output?.total_pieces);
        dayTotals[dateKey].pouch.pieces += pieces;
        rangeTotals.pouch.pieces += pieces;
        shiftBucket.pouch.pieces += pieces;
        return;
      }

      if (category === 'baby') {
        const units = toNumber(output?.output_count);
        dayTotals[dateKey].baby.units += units;
        rangeTotals.baby.units += units;
        shiftBucket.baby.units += units;
      }
    });
  });

  const byDay = dateList.map((date) => ({
    date,
    totals: dayTotals[date] || emptyProductionTotals(),
  }));

  return { totals: rangeTotals, dayShiftTotals, nightShiftTotals, byDay };
};

const buildSalesSummary = (challans, dateList) => {
  const dayTotals = {};
  const totals = {
    challans: 0,
    boxes: 0,
    pieces: 0,
    grossWeight: 0,
  };

  dateList.forEach((date) => {
    dayTotals[date] = {
      challans: 0,
      boxes: 0,
      pieces: 0,
      grossWeight: 0,
    };
  });

  challans.forEach((challan) => {
    const timestamp = challan?.status_changed_at || challan?.created_at;
    if (!timestamp) return;
    const dateKey = getKolkataDateString(new Date(timestamp));
    if (!dayTotals[dateKey]) {
      dayTotals[dateKey] = {
        challans: 0,
        boxes: 0,
        pieces: 0,
        grossWeight: 0,
      };
    }

    const items = Array.isArray(challan?.items) ? challan.items : [];
    const boxes = items.length;
    const pieces = items.reduce((sum, item) => sum + toNumber(item?.pieces), 0);
    const grossWeight = items.reduce((sum, item) => sum + toNumber(item?.weight), 0);

    dayTotals[dateKey].challans += 1;
    dayTotals[dateKey].boxes += boxes;
    dayTotals[dateKey].pieces += pieces;
    dayTotals[dateKey].grossWeight += grossWeight;

    totals.challans += 1;
    totals.boxes += boxes;
    totals.pieces += pieces;
    totals.grossWeight += grossWeight;
  });

  const byDay = dateList.map((date) => ({
    date,
    ...dayTotals[date],
  }));

  return { totals, byDay };
};

const buildPowerSummary = (events, dateList) => {
  const totals = { cuts: 0, ins: 0, totalDowntimeMinutes: 0 };
  const dayTotals = {};

  dateList.forEach((date) => {
    dayTotals[date] = { cuts: 0, ins: 0 };
  });

  // Sort events by occurred_at to calculate downtime
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  let lastCutTime = null;

  sortedEvents.forEach((event) => {
    if (!event?.occurred_at) return;
    const dateKey = getKolkataDateString(new Date(event.occurred_at));
    if (!dayTotals[dateKey]) {
      dayTotals[dateKey] = { cuts: 0, ins: 0 };
    }
    
    if (event.event_type === 'cut') {
      dayTotals[dateKey].cuts += 1;
      totals.cuts += 1;
      lastCutTime = new Date(event.occurred_at);
    } else if (event.event_type === 'in') {
      dayTotals[dateKey].ins += 1;
      totals.ins += 1;
      
      // Calculate downtime if we have a previous cut
      if (lastCutTime) {
        const inTime = new Date(event.occurred_at);
        const downtimeMs = inTime.getTime() - lastCutTime.getTime();
        const downtimeMinutes = Math.floor(downtimeMs / (1000 * 60));
        totals.totalDowntimeMinutes += downtimeMinutes;
        lastCutTime = null;
      }
    }
  });

  const byDay = dateList.map((date) => ({
    date,
    cuts: dayTotals[date]?.cuts || 0,
    ins: dayTotals[date]?.ins || 0,
  }));

  return { totals, byDay };
};

const fetchRawMaterialEntries = (startDate, endDate) =>
  supabase
    .from('raw_material_entries')
    .select('*')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date', { ascending: true })
    .limit(REPORT_ROW_LIMIT);

const fetchMaterials = () =>
  supabase
    .from('raw_material_types')
    .select('*')
    .order('created_at', { ascending: true });

const fetchProductionOutputs = (startDate, endDate) =>
  supabase
    .from('production_shifts')
    .select('*, production_outputs(*)')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date', { ascending: true })
    .limit(REPORT_ROW_LIMIT);

const fetchChallanSales = async (startIso, endIso) => {
  const primary = await supabase
    .from('challans')
    .select('*')
    .eq('status', 'departed')
    .gte('status_changed_at', startIso)
    .lte('status_changed_at', endIso)
    .limit(REPORT_ROW_LIMIT);

  const fallback = await supabase
    .from('challans')
    .select('*')
    .eq('status', 'departed')
    .is('status_changed_at', null)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .limit(REPORT_ROW_LIMIT);

  if (primary.error) throw primary.error;
  if (fallback.error) throw fallback.error;

  const combined = [...(primary.data || []), ...(fallback.data || [])];
  const seen = new Set();
  const unique = [];
  combined.forEach((row) => {
    if (!row?.id || seen.has(row.id)) return;
    seen.add(row.id);
    unique.push(row);
  });

  return unique;
};

const fetchPowerEvents = (startIso, endIso) =>
  supabase
    .from('power_events')
    .select('*')
    .gte('occurred_at', startIso)
    .lte('occurred_at', endIso)
    .order('occurred_at', { ascending: true })
    .limit(REPORT_ROW_LIMIT);

const fetchPurchaseEntries = (startDate, endDate) =>
  supabase
    .from('purchase_entries')
    .select('*')
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDate)
    .order('purchase_date', { ascending: true })
    .limit(REPORT_ROW_LIMIT);

const buildPurchaseSummary = (entries, materials, dateList) => {
  const materialList = materials
    .filter((m) => m?.id)
    .map((m) => ({ key: m.id, name: m.name || 'Unknown' }));

  const rangeTotals = {};
  const dayTotals = {};

  dateList.forEach((date) => {
    dayTotals[date] = {};
    materialList.forEach((m) => { dayTotals[date][m.key] = 0; });
  });
  materialList.forEach((m) => { rangeTotals[m.key] = 0; });

  entries.forEach((entry) => {
    const dateKey = entry?.purchase_date;
    const matKey = entry?.material_id;
    if (!dateKey || !matKey) return;

    if (!dayTotals[dateKey]) {
      dayTotals[dateKey] = {};
      materialList.forEach((m) => { dayTotals[dateKey][m.key] = 0; });
    }

    const qty = toNumber(entry?.quantity);
    if (dayTotals[dateKey][matKey] !== undefined) dayTotals[dateKey][matKey] += qty;
    if (rangeTotals[matKey] !== undefined) rangeTotals[matKey] += qty;
  });

  const totals = materialList.map((m) => ({
    key: m.key,
    name: m.name,
    quantity: rangeTotals[m.key] || 0,
  }));

  const byDay = dateList.map((date) => ({
    date,
    materials: materialList.map((m) => ({
      key: m.key,
      name: m.name,
      quantity: dayTotals[date]?.[m.key] || 0,
    })),
  }));

  return { totals, byDay };
};

export const reportService = {
  async getReports(preset) {
    const range = getPresetRange(preset);
    const dateList = getDateRangeList(range.startDate, range.endDate);

    const startIso = toKolkataStartOfDayISO(range.startDate);
    const endIso = toKolkataEndOfDayISO(range.endDate);

    const [materialsResult, rawEntriesResult, productionResult, powerResult, challans, purchaseResult] = await Promise.all([
      fetchMaterials(),
      fetchRawMaterialEntries(range.startDate, range.endDate),
      fetchProductionOutputs(range.startDate, range.endDate),
      fetchPowerEvents(startIso, endIso),
      fetchChallanSales(startIso, endIso),
      fetchPurchaseEntries(range.startDate, range.endDate),
    ]);

    if (materialsResult.error) throw materialsResult.error;
    if (rawEntriesResult.error) throw rawEntriesResult.error;
    if (productionResult.error) throw productionResult.error;
    if (powerResult.error) throw powerResult.error;
    // Purchase errors are non-fatal (feature may be hidden)
    const purchaseEntries = Array.isArray(purchaseResult?.data) ? purchaseResult.data : [];

    const materials = Array.isArray(materialsResult.data) ? materialsResult.data : [];
    const rawEntries = Array.isArray(rawEntriesResult.data) ? rawEntriesResult.data : [];
    const shifts = Array.isArray(productionResult.data) ? productionResult.data : [];
    const powerEvents = Array.isArray(powerResult.data) ? powerResult.data : [];

    const rawMaterialsSummary = buildRawMaterialSummary(rawEntries, materials, dateList);
    const purchasesSummary = buildPurchaseSummary(purchaseEntries, materials, dateList);
    const productionSummary = buildProductionSummary(shifts, dateList);
    const salesSummary = buildSalesSummary(challans, dateList);
    const powerSummary = buildPowerSummary(powerEvents, dateList);

    return {
      range: {
        ...range,
        dates: dateList,
      },
      rawMaterials: rawMaterialsSummary,
      production: productionSummary,
      sales: salesSummary,
      power: powerSummary,
      purchases: purchasesSummary,
    };
  },

  // Cumulative stock balance as of `targetDate`:
  //   balance = Σ purchases(≤ date) − Σ raw-material usage(≤ date), per active material.
  // Returns `hasPurchases` so the UI can show a "needs purchase data" state instead
  // of rendering misleading negative balances when nothing has ever been purchased.
  async getStockBalance(targetDate) {
    const targetDateStr = typeof targetDate === 'string' ? targetDate : getKolkataDateString(targetDate);

    const [materialsResult, purchaseResult, rawEntriesResult] = await Promise.all([
      fetchMaterials(),
      supabase
        .from('purchase_entries')
        .select('*')
        .lte('purchase_date', targetDateStr)
        .limit(REPORT_ROW_LIMIT),
      supabase
        .from('raw_material_entries')
        .select('*')
        .lte('shift_date', targetDateStr)
        .limit(REPORT_ROW_LIMIT),
    ]);

    if (materialsResult.error) throw materialsResult.error;
    if (purchaseResult.error) throw purchaseResult.error;
    if (rawEntriesResult.error) throw rawEntriesResult.error;

    const materials = Array.isArray(materialsResult.data) ? materialsResult.data : [];
    const purchaseEntries = Array.isArray(purchaseResult.data) ? purchaseResult.data : [];
    const rawEntries = Array.isArray(rawEntriesResult.data) ? rawEntriesResult.data : [];

    const materialList = materials
      .filter((m) => m?.id && m?.is_active)
      .map((m) => ({ key: m.id, name: m.name || 'Unknown' }));

    const purchasedMap = {};
    const usedMap = {};

    materialList.forEach((m) => {
      purchasedMap[m.key] = 0;
      usedMap[m.key] = 0;
    });

    let totalPurchased = 0;
    purchaseEntries.forEach((entry) => {
      const matKey = entry?.material_id;
      if (!matKey) return;
      const qty = toNumber(entry?.quantity);
      totalPurchased += qty;
      if (purchasedMap[matKey] !== undefined) {
        purchasedMap[matKey] += qty;
      }
    });

    rawEntries.forEach((entry) => {
      (entry?.materials || []).forEach((item) => {
        const key = item?.material_id || item?.name;
        if (!key) return;
        if (usedMap[key] !== undefined) {
          usedMap[key] += toNumber(item?.quantity);
        }
      });
    });

    const materialsBalance = materialList.map((m) => ({
      key: m.key,
      name: m.name,
      purchased: purchasedMap[m.key],
      used: usedMap[m.key],
      balance: purchasedMap[m.key] - usedMap[m.key],
    }));

    // Stock is only meaningful once purchases exist; without any purchase rows,
    // "balance" would just be negated usage. Signal that to the UI.
    return {
      hasPurchases: totalPurchased > 0,
      materials: materialsBalance,
    };
  },
};
