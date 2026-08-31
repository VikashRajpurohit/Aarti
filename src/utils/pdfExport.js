//Content view - PDF Export Utility with Professional Design
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { format } from 'date-fns';

/**
 * Generate professional PDF challan document
 * @param {Object} challan - Challan object with items, challan number, etc.
 * @returns {Promise<string>} File URI of generated PDF
 */
export async function exportChallanToPDF(challan) {
  try {
    // Format date as DD.MM.YY
    const formattedDate = format(new Date(challan.date), 'dd.MM.yy');
    
    // Challan display name
    const challanName = challan.name;
    const challanNumber = challan.challanNumber;
    
    // Group items by itemName (same as Excel)
    const groupedItems = {};
    challan.items.forEach(item => {
      if (!groupedItems[item.itemName]) {
        groupedItems[item.itemName] = [];
      }
      groupedItems[item.itemName].push(item);
    });

    // Generate HTML content
    const htmlContent = generateHTML(challanName, challanNumber, formattedDate, groupedItems, challan);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // Create a better filename
    const safeFileName = `Challan_${challanNumber}`;
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const fileName = `${safeFileName}_${timestamp}.pdf`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    // Move file to permanent location
    await FileSystem.moveAsync({
      from: uri,
      to: fileUri,
    });

    // Share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Challan: #${challanNumber}`,
        UTI: 'com.adobe.pdf',
      });
    }

    return fileUri;
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}

/**
 * Generate HTML template for PDF
 */
function generateHTML(challanName, challanNumber, formattedDate, groupedItems, challan) {
  // Generate item groups HTML
  let itemGroupsHTML = '';
  
  Object.entries(groupedItems).forEach(([itemName, items], index) => {
    const boxCount = items.length;
    let totalGrossWeight = 0.0;
    let totalNetWeight = 0.0;
    
    // Generate rows for this group
    let rowsHTML = '';
    items.forEach(item => {
      totalGrossWeight += item.weight;
      const netWeight = challan.getItemNetWeight(item);
      totalNetWeight += netWeight;
      
      // Conditional net weight cell
      const netWeightCell = challan.noNetWeightRequired
        ? ''
        : `<td style="text-align: right; padding: 8px; border-bottom: 1px solid #E0E0E0;">${netWeight.toFixed(3)}</td>`;
      
      rowsHTML += `
        <tr>
          <td style="text-align: left; padding: 8px; border-bottom: 1px solid #E0E0E0;">${item.boxNo}</td>
          <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E0E0E0;">${item.weight.toFixed(3)}</td>
          ${netWeightCell}
        </tr>
      `;
    });

    // Add group section
    itemGroupsHTML += `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <!-- Group Header -->
        <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 12px 16px; border-radius: 8px 8px 0 0; border-left: 4px solid #2196F3;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 14px; color: #1976D2;">${boxCount} BOX</span>
            <span style="font-weight: 600; font-size: 14px; color: #333333;">${itemName}</span>
          </div>
        </div>
        
        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #F5F5F5;">
              <th style="text-align: left; padding: 10px 8px; font-weight: 600; font-size: 12px; color: #555; border-bottom: 2px solid #2196F3;">Box No.</th>
              <th style="text-align: right; padding: 10px 8px; font-weight: 600; font-size: 12px; color: #555; border-bottom: 2px solid #2196F3;">Gross Weight (Kg)</th>
              ${challan.noNetWeightRequired ? '' : '<th style="text-align: right; padding: 10px 8px; font-weight: 600; font-size: 12px; color: #555; border-bottom: 2px solid #2196F3;">Net Weight (Kg)</th>'}
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
          <tfoot>
            <tr style="background: #E8F5E9; font-weight: 600;">
              <td style="padding: 10px 8px; color: #2E7D32; border-top: 2px solid #4CAF50;">TOTAL</td>
              <td style="text-align: right; padding: 10px 8px; color: #2E7D32; border-top: 2px solid #4CAF50;">${totalGrossWeight.toFixed(3)}</td>
              ${challan.noNetWeightRequired ? '' : `<td style="text-align: right; padding: 10px 8px; color: #2E7D32; border-top: 2px solid #4CAF50;">${totalNetWeight.toFixed(3)}</td>`}
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  });

  // Generate complete HTML
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          color: #333;
          padding: 24px;
          background: #FAFAFA;
        }
        
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 32px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header {
          text-align: center;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 3px solid #2196F3;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1976D2;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        
        .header .subtitle {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 32px;
          padding: 16px;
          background: #F5F5F5;
          border-radius: 6px;
          border-left: 4px solid #4CAF50;
        }
        
        .info-item {
          flex: 1;
        }
        
        .info-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #000;
        }
        
        .summary-section {
          margin-top: 32px;
          padding: 20px;
          background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
          border-radius: 8px;
          border-left: 4px solid #2196F3;
        }
        
        .summary-title {
          font-size: 16px;
          font-weight: 700;
          color: #1976D2;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(${challan.noNetWeightRequired ? 2 : 3}, 1fr);
          gap: 16px;
        }
        
        .summary-item {
          background: white;
          padding: 12px;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .summary-item-label {
          font-size: 11px;
          color: #666;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        
        .summary-item-value {
          font-size: 18px;
          font-weight: 700;
          color: #2E7D32;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #E0E0E0;
          text-align: center;
          font-size: 11px;
          color: #999;
        }
        
        @media print {
          body {
            background: white;
            padding: 0;
          }
          .container {
            box-shadow: none;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>DELIVERY CHALLAN</h1>
          <div class="subtitle">Aarti Polymers</div>
        </div>
        
        <!-- Info Section -->
        <div class="info-section">
          <div class="info-item">
            <div class="info-label">Challan Number</div>
            <div class="info-value">#${challanNumber}</div>
          </div>
          <div class="info-item" style="text-align: right;">
            <div class="info-label">Date</div>
            <div class="info-value">${formattedDate}</div>
          </div>
        </div>
        
        <!-- Item Groups -->
        ${itemGroupsHTML}
        
        <!-- Summary Section -->
        <div class="summary-section">
          <div class="summary-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-item-label">Total Boxes</div>
              <div class="summary-item-value">${challan.totalBoxes}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">Total Gross Weight</div>
              <div class="summary-item-value">${challan.totalGrossWeight.toFixed(3)} Kg</div>
            </div>
            ${challan.noNetWeightRequired ? '' : `
            <div class="summary-item">
              <div class="summary-item-label">Total Net Weight</div>
              <div class="summary-item-value">${challan.totalNetWeight.toFixed(3)} Kg</div>
            </div>
            `}
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')}
        </div>
      </div>
    </body>
    </html>
  `;
}
