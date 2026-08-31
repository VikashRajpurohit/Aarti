//Content view - ScannedItem Model
export class ScannedItem {
  constructor({
    boxNo,
    size,
    batchNo,
    product,
    weight,
    itemName,
    pieces,
    scannedAt,
  }) {
    this.boxNo = boxNo; // ZS No from QR
    this.size = size; // Size from QR
    this.batchNo = batchNo; // Full batch number
    this.product = product; // Product name
    this.weight = weight; // Weight from QR
    this.itemName = itemName; // Size/First two letters of BatchNO
    this.pieces = pieces || 0; // Number of pieces in the box
    this.scannedAt = scannedAt || new Date();
  }

  toJSON() {
    return {
      boxNo: this.boxNo,
      size: this.size,
      batchNo: this.batchNo,
      product: this.product,
      weight: this.weight,
      itemName: this.itemName,
      pieces: this.pieces,
      scannedAt: this.scannedAt.toISOString(),
    };
  }

  static fromJSON(json) {
    return new ScannedItem({
      boxNo: json.boxNo,
      size: json.size,
      batchNo: json.batchNo,
      product: json.product,
      weight: json.weight,
      itemName: json.itemName,
      pieces: json.pieces || 0,
      scannedAt: new Date(json.scannedAt),
    });
  }
}

