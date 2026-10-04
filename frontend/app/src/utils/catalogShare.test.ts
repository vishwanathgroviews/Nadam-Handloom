import { describe, expect, it } from 'vitest';
import { catalogCaption, catalogFilename } from './catalogShare';

describe('catalogCaption', () => {
  it('names the subcategory and asks for the piece ID', () => {
    expect(catalogCaption('Kanchi Pattu')).toBe(
      'Nandam Handlooms – Kanchi Pattu catalogue. Please tell us the ID number of the piece you like.'
    );
  });

  it('still reads properly when the subcategory name is missing', () => {
    expect(catalogCaption('  ')).toBe(
      'Nandam Handlooms – catalogue. Please tell us the ID number of the piece you like.'
    );
  });
});

describe('catalogFilename', () => {
  it('turns the subcategory name into a safe file name', () => {
    expect(catalogFilename('Kanchi Pattu')).toBe('Nandam-Kanchi-Pattu-catalogue.pdf');
    expect(catalogFilename('150/50 Embroidery')).toBe('Nandam-150-50-Embroidery-catalogue.pdf');
  });

  it('drops characters a file name cannot carry', () => {
    expect(catalogFilename(' పట్టు / Silk? ')).toBe('Nandam-Silk-catalogue.pdf');
    expect(catalogFilename('')).toBe('Nandam-catalogue.pdf');
  });
});
