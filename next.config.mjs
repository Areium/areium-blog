export default {
  poweredByHeader: false,
  images: { qualities: [75, 95] },
  async headers() {
    return [{
      source: '/ascii/:file',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/fonts/:path*',
      // Sandboxed article frames have an opaque origin, but share these public fonts.
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    }, {
      // Generated filenames contain a content hash; changes get a new URL.
      source: '/fonts/oppo-sans/:file',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
};
