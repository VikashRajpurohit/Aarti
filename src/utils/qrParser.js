//Content view - QR Parser Utility
import { ScannedItem } from '../models/ScannedItem';

// Parse QR data: 03045$300 $09$05HD1411    $STRETCH     $032.590
// Format: BoxNo$Size$Pieces$BatchNo$Product$Weight
export function parseQRData(qrData) {
  try {
    // Split by $ and filter out empty strings, then trim each part
    const parts = qrData.split('$').map(s => s.trim()).filter(s => s.length > 0);
    
    if (parts.length < 6) return null;

    const boxNo = parts[0]; // 03045
    const size = parts[1]; // 300
    const pieces = parseInt(parts[2], 10) || 0; // 09 -> pieces count
    const batchNo = parts[3]; // 05HD1411
    const product = parts[4]; // STRETCH
    const weightStr = parts[5]; // 032.590

    const weight = parseFloat(weightStr);
    if (isNaN(weight)) return null;

    // Item name: Size/First two letters of BatchNO
    const itemName = batchNo.length >= 2
      ? `${size}/${batchNo.substring(0, 2)}`
      : size;

    return new ScannedItem({
      boxNo,
      size,
      batchNo,
      product,
      weight,
      itemName,
      pieces,
      scannedAt: new Date(),
    });
  } catch (error) {
    console.error('Error parsing QR data:', error);
    return null;
  }
}

