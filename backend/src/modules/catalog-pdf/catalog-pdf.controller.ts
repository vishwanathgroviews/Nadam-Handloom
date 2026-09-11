import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as catalogPdfService from './catalog-pdf.service';

export const getStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = await catalogPdfService.getCatalogPdfStatus(req.params.subcategoryId as string);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

export const generate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await catalogPdfService.generateCatalogPdf(req.params.subcategoryId as string, req.user!.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="catalog.pdf"');
    res.setHeader('X-Product-Count', String(result.productCount));
    res.status(200).send(result.pdf);
  } catch (error) {
    next(error);
  }
};
