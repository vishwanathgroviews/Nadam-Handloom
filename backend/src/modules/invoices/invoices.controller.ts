import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import * as invoicesService from './invoices.service';

interface ValidatedBodyRequest extends AuthenticatedRequest {
  body: any;
}

export const list = async (req: QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = req.validatedQuery;
    const result = await invoicesService.listInvoices(query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await invoicesService.getInvoice(req.params.id as string);
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

export const report = async (req: ValidatedBodyRequest, res: Response, next: NextFunction) => {
  try {
    const pdf = await invoicesService.generateSalesReportPdf(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="sales-summary.pdf"');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
};
