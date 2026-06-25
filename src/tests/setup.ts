import '@testing-library/jest-dom/vitest';

class TestImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = 'srgb';

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
      return;
    }

    this.data = dataOrWidth;
    this.width = widthOrHeight;
    this.height = height ?? Math.floor(dataOrWidth.length / 4 / widthOrHeight);
  }
}

if (!globalThis.ImageData) {
  globalThis.ImageData = TestImageData as typeof ImageData;
}
