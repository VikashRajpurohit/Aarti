//Challan Model - Simplified with Challan Number
import { ScannedItem } from './ScannedItem';

export const CHALLAN_STATUS = {
  IN_PROGRESS: 'in_progress',
  DEPARTED: 'departed',
  DELETED: 'deleted',
};

export class Challan {
  constructor({
    id,
    challanNumber, // Up to 6 digit number (e.g., "123456")
    date,
    items = [],
    status = CHALLAN_STATUS.IN_PROGRESS,
    noNetWeightRequired,
    productDeductions,
    createdAt,
    statusChangedAt,
    deletedAt,
  }) {
    this.id = id || Date.now().toString();
    this.challanNumber = challanNumber;
    this.date = date instanceof Date ? date : new Date(date || Date.now());
    this.items = items;
    this.status = status;
    
    // Net weight management
    this.noNetWeightRequired = noNetWeightRequired ?? true;
    this.productDeductions = productDeductions || {};
    
    // Audit fields
    this.createdAt = createdAt || new Date().toISOString();
    this.statusChangedAt = statusChangedAt;
    this.deletedAt = deletedAt;
  }

  // Display name is just the challan number
  get name() {
    return this.challanNumber;
  }

  get totalBoxes() {
    return this.items.length;
  }

  get totalPieces() {
    return this.items.reduce((sum, item) => sum + (item.pieces || 0), 0);
  }

  get totalGrossWeight() {
    return this.items.reduce((sum, item) => sum + item.weight, 0);
  }

  get totalNetWeight() {
    if (this.noNetWeightRequired) return 0.0;
    
    return this.items.reduce((sum, item) => {
      const deduction = this.productDeductions[item.itemName] || 0;
      const netWeight = item.weight - deduction;
      return sum + Math.max(0, netWeight);
    }, 0);
  }

  getProductNetWeight(productName) {
    if (this.noNetWeightRequired) return 0.0;
    
    const deduction = this.productDeductions[productName] || 0;
    const productItems = this.items.filter(i => i.itemName === productName);
    
    return productItems.reduce((sum, item) => {
      const netWeight = item.weight - deduction;
      return sum + Math.max(0, netWeight);
    }, 0);
  }

  getItemNetWeight(item) {
    if (this.noNetWeightRequired) return 0.0;
    
    const deduction = this.productDeductions[item.itemName] || 0;
    return Math.max(0, item.weight - deduction);
  }

  isInProgress() {
    return this.status === CHALLAN_STATUS.IN_PROGRESS;
  }

  isDeparted() {
    return this.status === CHALLAN_STATUS.DEPARTED;
  }

  isDeleted() {
    return this.status === CHALLAN_STATUS.DELETED;
  }

  toJSON() {
    return {
      id: this.id,
      challan_number: this.challanNumber,
      // date: this.date.toISOString(), // Removed: Supabase uses created_at
      items: this.items.map(item => item.toJSON ? item.toJSON() : item),
      status: this.status,
      no_net_weight_required: this.noNetWeightRequired,
      product_deductions: this.productDeductions,
      created_at: this.createdAt,
      status_changed_at: this.statusChangedAt,
      deleted_at: this.deletedAt,
    };
  }

  static fromJSON(json) {
    return new Challan({
      id: json.id,
      challanNumber: json.challan_number || json.challanNumber || json.name,
      date: json.created_at ? new Date(json.created_at) : (json.date ? new Date(json.date) : new Date()),
      items: (json.items || []).map(item => ScannedItem.fromJSON ? ScannedItem.fromJSON(item) : item),
      status: json.status || CHALLAN_STATUS.IN_PROGRESS,
      noNetWeightRequired: json.no_net_weight_required ?? json.noNetWeightRequired ?? true,
      productDeductions: json.product_deductions || json.productDeductions || {},
      createdAt: json.created_at || json.createdAt,
      statusChangedAt: json.status_changed_at || json.statusChangedAt,
      deletedAt: json.deleted_at || json.deletedAt,
    });
  }
}
