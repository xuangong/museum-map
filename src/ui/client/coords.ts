// Source of truth for WGS-84 → GCJ-02 (and the server-side test mirror)
export const COORDS_SCRIPT = `
(function(global){
  var PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323;
  function outOfChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  function transformLat(x, y) {
    var ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0;
    ret += (20.0*Math.sin(y*PI) + 40.0*Math.sin(y/3.0*PI)) * 2.0/3.0;
    ret += (160.0*Math.sin(y/12.0*PI) + 320*Math.sin(y*PI/30.0)) * 2.0/3.0;
    return ret;
  }
  function transformLng(x, y) {
    var ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0;
    ret += (20.0*Math.sin(x*PI) + 40.0*Math.sin(x/3.0*PI)) * 2.0/3.0;
    ret += (150.0*Math.sin(x/12.0*PI) + 300.0*Math.sin(x/30.0*PI)) * 2.0/3.0;
    return ret;
  }
  function wgs84ToGcj02(wgsLat, wgsLng) {
    if (outOfChina(wgsLat, wgsLng)) return [wgsLat, wgsLng];
    var dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
    var dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
    var radLat = wgsLat / 180.0 * PI;
    var magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
    return [wgsLat + dLat, wgsLng + dLng];
  }
  global.outOfChina = outOfChina;
  global.wgs84ToGcj02 = wgs84ToGcj02;
  global.toMapCoord = wgs84ToGcj02;
})(window);
`

/** Server-side mirror for tests (same algorithm). */
export function toMapCoord(lat: number, lng: number): [number, number] {
  const PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng]
  const tLat = (x: number, y: number) => {
    let ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x))
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0
    ret += (20.0*Math.sin(y*PI) + 40.0*Math.sin(y/3.0*PI)) * 2.0/3.0
    ret += (160.0*Math.sin(y/12.0*PI) + 320*Math.sin(y*PI/30.0)) * 2.0/3.0
    return ret
  }
  const tLng = (x: number, y: number) => {
    let ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x))
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0
    ret += (20.0*Math.sin(x*PI) + 40.0*Math.sin(x/3.0*PI)) * 2.0/3.0
    ret += (150.0*Math.sin(x/12.0*PI) + 300.0*Math.sin(x/30.0*PI)) * 2.0/3.0
    return ret
  }
  let dLat = tLat(lng - 105.0, lat - 35.0)
  let dLng = tLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * PI)
  return [lat + dLat, lng + dLng]
}
