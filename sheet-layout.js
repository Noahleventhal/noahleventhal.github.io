// Prefix offsets keep viewport lookup and hit testing correct for unequal cell sizes.
export class SheetLayout {
  constructor(sheet, zoom = 1, preview = null) {
    this.zoom = zoom;
    const offsets = (count, sizes, fallback, axis) => {
      const result = [0];
      for (let index = 0; index < count; index++) {
        const size = preview?.axis === axis && preview.index === index ? preview.size : sizes?.[index] ?? fallback;
        result.push(result[index] + size * zoom);
      }
      return result;
    };
    this.columns = offsets(sheet.cols, sheet.columnWidths, 100, 'col');
    this.rows = offsets(sheet.rows, sheet.rowHeights, 24, 'row');
  }
  x(col) {return this.columns[col];}
  y(row) {return this.rows[row];}
  width(col) {return this.columns[col + 1] - this.columns[col];}
  height(row) {return this.rows[row + 1] - this.rows[row];}
  get totalWidth() {return this.columns.at(-1);}
  get totalHeight() {return this.rows.at(-1);}
  indexAt(offsets, position) {
    let low = 0, high = offsets.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (offsets[middle] <= position) low = middle; else high = middle - 1;
    }
    return Math.max(0, Math.min(offsets.length - 2, low));
  }
  columnAt(position) {return this.indexAt(this.columns, position);}
  rowAt(position) {return this.indexAt(this.rows, position);}
}
