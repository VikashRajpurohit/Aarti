//Content view - Excel Export Utility with Professional Formatting
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export async function exportChallanToExcel(challan) {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create worksheet data array
    const wsData = [];

    // Date format: DD.MM.YY
    const formattedDate = format(new Date(challan.date), 'dd.MM.yy');

    // Row 0: Date (top left)
    wsData.push(['Date:', formattedDate]);
    
    // Row 1: Empty row for spacing
    wsData.push([]);

    // Row 2: Challan Number
    const challanNumber = challan.challanNumber;
    wsData.push([`CHALLAN #${challanNumber}`]);
    
    // Row 3: Empty row for spacing
    wsData.push([]);

    // Group items by item name (Size/BatchNO prefix)
    const groupedItems = {};
    challan.items.forEach(item => {
      if (!groupedItems[item.itemName]) {
        groupedItems[item.itemName] = [];
      }
      groupedItems[item.itemName].push(item);
    });

    let currentRow = 4;

    // Create table for each group
    Object.entries(groupedItems).forEach(([itemName, items], groupIndex) => {
      const boxCount = items.length;
      const groupPieces = items.reduce((sum, item) => sum + (item.pieces || 0), 0);
      
      // Group header row with box count, pieces, and item specification
      wsData[currentRow] = [`${boxCount} BOX`, `${groupPieces} PCS`, itemName];
      currentRow++;

      // Column headers - conditional based on net weight requirement
      const headers = challan.noNetWeightRequired
        ? ['Box No.', 'Pieces', 'Gross Weight (Kg)']
        : ['Box No.', 'Pieces', 'Gross Weight (Kg)', 'Net Weight (Kg)'];
      wsData[currentRow] = headers;
      currentRow++;

      let totalGrossWeight = 0.0;
      let totalNetWeight = 0.0;
      let totalPieces = 0;

      // Add items
      items.forEach(item => {
        const row = [
          item.boxNo,
          item.pieces || 0,
          item.weight.toFixed(3),
        ];
        
        // Add net weight column if required
        if (!challan.noNetWeightRequired) {
          const netWeight = challan.getItemNetWeight(item);
          row.push(netWeight.toFixed(3));
          totalNetWeight += netWeight;
        }
        
        wsData[currentRow] = row;
        totalGrossWeight += item.weight;
        totalPieces += (item.pieces || 0);
        currentRow++;
      });

      // Total row - conditional based on net weight requirement
      const totalRow = [
        'TOTAL',
        totalPieces,
        totalGrossWeight.toFixed(3),
      ];
      
      if (!challan.noNetWeightRequired) {
        totalRow.push(totalNetWeight.toFixed(3));
      }
      
      wsData[currentRow] = totalRow;
      currentRow++;

      // Add spacing between groups (unless it's the last group)
      if (groupIndex < Object.entries(groupedItems).length - 1) {
        wsData[currentRow] = [];
        currentRow++;
      }
    });

    // Add summary section at the bottom
    currentRow += 2; // Extra spacing
    wsData[currentRow] = ['SUMMARY'];
    currentRow++;
    wsData[currentRow] = ['Total Boxes:', challan.totalBoxes];
    currentRow++;
    wsData[currentRow] = ['Total Pieces:', challan.totalPieces];
    currentRow++;
    wsData[currentRow] = ['Total Gross Weight:', challan.totalGrossWeight.toFixed(3) + ' Kg'];
    currentRow++;
    
    // Only add net weight summary if required
    if (!challan.noNetWeightRequired) {
      wsData[currentRow] = ['Total Net Weight:', challan.totalNetWeight.toFixed(3) + ' Kg'];
      currentRow++;
    }

    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths for better readability - conditional based on net weight
    ws['!cols'] = challan.noNetWeightRequired
      ? [
          { wch: 18 }, // Box No. / Labels
          { wch: 10 }, // Pieces
          { wch: 20 }, // Gross Weight
        ]
      : [
          { wch: 18 }, // Box No. / Labels
          { wch: 10 }, // Pieces
          { wch: 20 }, // Gross Weight
          { wch: 20 }, // Net Weight
        ];

    // Merge cells for challan name header (row 2)
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } });

    // Apply cell styles (if supported by the library)
    // Note: Basic styling - xlsx library has limited formatting support
    // For advanced formatting, you'd need xlsx-style or similar
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Challan');

    // Generate Excel file buffer
    const wbout = XLSX.write(workbook, { 
      type: 'base64', 
      bookType: 'xlsx',
      cellStyles: true 
    });

    // Save to file system - Use challan number in filename
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const fileName = `Challan_${challanNumber}_${timestamp}.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Share Challan: #${challanNumber}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    return fileUri;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
}
