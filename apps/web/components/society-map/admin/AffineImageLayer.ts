import L from 'leaflet';

/*
 * An image laid on the map by its corners — turned, scaled and skewed with
 * one CSS matrix, recomputed whenever the map moves. The dashboard uses it to
 * preview a master plan while its points are being placed (the public site
 * draws the finished tiles instead).
 *
 * `corners` are the image's tl, tr, br, bl on the ground, [lat, lng].
 */
export class AffineImageLayer extends L.Layer {
  private img: HTMLImageElement | null = null;
  private corners: number[][];
  private url: string;
  private opacity: number;

  constructor(url: string, corners: number[][], opacity = 0.7) {
    super();
    this.url = url;
    this.corners = corners;
    this.opacity = opacity;
  }

  onAdd(map: L.Map): this {
    const img = L.DomUtil.create('img', 'leaflet-zoom-hide') as HTMLImageElement;
    img.src = this.url;
    img.alt = '';
    Object.assign(img.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      transformOrigin: '0 0',
      pointerEvents: 'none',
      maxWidth: 'none',
      opacity: String(this.opacity),
      zIndex: '200',
    });
    img.onload = () => this.update();
    map.getPane('overlayPane')!.appendChild(img);
    this.img = img;
    map.on('zoomend viewreset moveend', this.update, this);
    this.update();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('zoomend viewreset moveend', this.update, this);
    this.img?.remove();
    this.img = null;
    return this;
  }

  setCorners(corners: number[][]) {
    this.corners = corners;
    this.update();
  }

  setOpacity(opacity: number) {
    this.opacity = opacity;
    if (this.img) this.img.style.opacity = String(opacity);
  }

  private update() {
    const map = this._map;
    const img = this.img;
    if (!map || !img || !img.naturalWidth || this.corners.length < 4) return;
    const [tl, tr, , bl] = this.corners.map((c) => map.latLngToLayerPoint([c[0]!, c[1]!]));
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const a = (tr!.x - tl!.x) / w;
    const b = (tr!.y - tl!.y) / w;
    const c = (bl!.x - tl!.x) / h;
    const d = (bl!.y - tl!.y) / h;
    img.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${tl!.x}, ${tl!.y})`;
  }
}
