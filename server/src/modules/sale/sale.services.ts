/* eslint-disable no-unsafe-finally */
/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from 'mongoose';
import sortAndPaginatePipeline from '../../lib/sortAndPaginate.pipeline';
import BaseServices from '../baseServices';
import Sale from './sale.model';
import Product from '../product/product.model';
import CustomError from '../../errors/customError';

class SaleServices extends BaseServices<any> {
  constructor(model: any, modelName: string) {
    super(model, modelName);
  }

  /**
   * Create new sale and decrease product stock
   */
  async create(payload: any, userId: string) {
    const { productPrice, quantity } = payload;
    payload.user = userId;
    payload.totalPrice = productPrice * quantity;

    const product = await Product.findById(payload.product);
    if (!product) {
      throw new CustomError(400, 'Product not found');
    }

    if (quantity > product.stock) {
      throw new CustomError(400, `${quantity} products are not available in stock!`);
    }

    let session: mongoose.ClientSession | null = null;
    if (mongoose.connection.readyState === 1 && mongoose.connection.client.s.options.replicaSet) {
      session = await mongoose.startSession();
    }

    try {
      if (session) session.startTransaction();

      // Decrease product stock
      await Product.findByIdAndUpdate(product._id, { $inc: { stock: -quantity } }, { session });
      
      // Create sale
      const result = await this.model.create([payload], session ? { session } : {});
      
      if (!result || result.length === 0) {
        throw new CustomError(400, 'Failed to create sale');
      }

      if (session) await session.commitTransaction();
      return result;
    } catch (error: any) {
      console.error('Error during sale creation:', error);

      if (session) await session.abortTransaction();

      throw new CustomError(400, `Sale create failed: ${error.message || 'Unknown error'}`);
    } finally {
      if (session) await session.endSession();
    }
  }

  /**
   * Get all sales
   */
  async readAll(query: Record<string, unknown> = {}, userId: string) {
    const search = query.search ? (query.search as string) : '';

    const data = await this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          $or: [
            { productName: { $regex: search, $options: 'i' } },
            { buyerName: { $regex: search, $options: 'i' } },
          ],
        },
      },
      ...sortAndPaginatePipeline(query),
    ]);

    const totalCount = await this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);

    return { data, totalCount };
  }

  async readAllWeeks(userId: string) {
    return await this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          date: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            week: { $isoWeek: '$date' },
            year: { $isoWeekYear: '$date' },
          },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalPrice' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.week': 1,
        },
      },
      {
        $project: {
          week: '$_id.week',
          year: '$_id.year',
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);
  }

  async readAllYearly(userId: string) {
    return await this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          date: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
          },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalPrice' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
        },
      },
      {
        $project: {
          year: '$_id.year',
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);
  }

  async readAllDaily(userId: string) {
    return await this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          date: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: '$date' },
            month: { $month: '$date' },
            year: { $year: '$date' },
          },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalPrice' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1,
        },
      },
      {
        $project: {
          day: '$_id.day',
          month: '$_id.month',
          year: '$_id.year',
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);
  }

  async readAllMonths(userId: string) {
    return await this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          date: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            year: { $year: '$date' },
          },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalPrice' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
      {
        $project: {
          month: '$_id.month',
          year: '$_id.year',
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);
  }

  // Get single sale
  async read(id: string, userId: string) {
    await this._isExists(id);
    return this.model.findOne({ user: new Types.ObjectId(userId), _id: id }).populate({
      path: 'product',
      select: '-createdAt -updatedAt -__v',
    });
  }
}

const saleServices = new SaleServices(Sale, 'modelName');
export default saleServices;
