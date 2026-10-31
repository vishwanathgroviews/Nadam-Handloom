// Website W2–W4: which craft a collection belongs to, from its name (first match wins). The
// owner checks the full list in docs/modules/web-02-home-and-shop.md.
import { describe, it, expect } from 'vitest';
import { craftOf } from '../../src/services/shop/catalog.service.js';

describe('craft from a collection name', () => {
  it.each([
    ['Gap border Embroidery sarees', 'embroidery'],
    ['Embossing scallop Embroidry blouse', 'embroidery'], // the shop's spelling
    ['100/50 border Chikankari Saree', 'embroidery'],
    ['50/50 Flower Bunch Applique', 'applique'],
    ['250/50 Digital print', 'digital'],
    ['50/50 Border Baguru Printed Saree', 'screen'],
    ['50/50 silk kalankari sarees', 'kalamkari'], // the shop's spelling
    ['Scallop border Tanjore Saree, Tanjore Blouse', 'kalamkari'],
    ['50/50 Middle Check hand painted sarees', 'kalamkari'], // painted comes before checks
    ['Real Bandini Shibori Hardweaving Saree', 'bandhani'],
    ['Rainbow checks sarees', 'checks'],
    ['Kanchi Border Triple Check Saree', 'checks'],
    ['Pure Pattu 350k Butta Saree', 'pure'],
    ['300 border hardweaving Buta sarees', 'pure'],
    ['300k border Plain Saree', 'pure'],
    ['150/50 Ikkath Flower Bunch Saree', null],
    ['Checkered', null],
  ])('%s → %s', (name, craft) => {
    expect(craftOf(name)).toBe(craft);
  });
});
