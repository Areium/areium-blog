export default {
  poweredByHeader: false,
  images: { qualities: [75, 95] },
  async headers() {
    return [{
      source: '/fonts/:path*',
      // Sandboxed article frames have an opaque origin, but share these public fonts.
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    }];
  },
};
