/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from 'mongoose';
import sortAndPaginatePipeline from '../../lib/sortAndPaginate.pipeline';
import BaseServices from '../baseServices';
import Product from './product.model';
import matchStagePipeline from './product.aggregation.pipeline';
import CustomError from '../../errors/customError';
import Purchase from '../purchase/purchase.model';
import Seller from '../seller/seller.model';
import { IProduct } from './product.interface';

class ProductServices extends BaseServices<any> {
  constructor(model: any, modelName: string) {
    super(model, modelName);
  }

  /**
   * Create new product
   */
  async create(payload: IProduct, userId: string) {
    // Clean up payload by removing empty fields
    Object.keys(payload).forEach((key) => {
      if (!payload[key]) {
        delete payload[key];
      }
    });

    payload.user = new Types.ObjectId(userId); // Set the user ID for the product

    let session: mongoose.ClientSession | null = null;
    if (mongoose.connection.readyState === 1 && mongoose.connection.client.s.options.replicaSet) {
      session = await mongoose.startSession();
    }

    try {
      if (session) session.startTransaction();

      // Ensure seller exists
      const seller = await Seller.findById(payload.seller);
      if (!seller) {
        throw new CustomError(400, 'Seller not found');
      }

      // Create the product
      const product = await this.model.create([payload], session ? { session } : {});
      if (!product || product.length === 0) {
        throw new CustomError(400, 'Failed to create product');
      }

      // Create a purchase record linked to the product
      await Purchase.create(
        [
          {
            user: userId,
            seller: product[0].seller,
            product: product[0]._id,
            sellerName: seller.name,
            productName: product[0].name,
            quantity: product[0].stock,
            unitPrice: product[0].price,
            totalPrice: product[0].stock * product[0].price,
          },
        ],
        session ? { session } : {}
      );

      if (session) await session.commitTransaction();
      return product;
    } catch (error: any) {
      console.error('Error during product creation:', error);

      if (session) await session.abortTransaction();

      throw new CustomError(400, `Product create failed: ${error.message || 'Unknown error'}`);
    } finally {
      if (session) await session.endSession();
    }
  }

  /**
   * Count Total Product
   */
  async countTotalProduct(userId: string) {
    return this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$stock' },
        },
      },
      {
        $project: {
          totalQuantity: 1,
          _id: 0,
        },
      },
    ]);
  }

  /**
   * Get All product of user
   */
  async readAll(query: Record<string, unknown> = {}, userId: string) {
    let data = await this.model.aggregate([...matchStagePipeline(query, userId), ...sortAndPaginatePipeline(query)]);

    const totalCount = await this.model.aggregate([
      ...matchStagePipeline(query, userId),
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

    data = await this.model.populate(data, { path: 'category', select: '-__v -user' });
    data = await this.model.populate(data, { path: 'brand', select: '-__v -user' });
    data = await this.model.populate(data, { path: 'seller', select: '-__v -user -createdAt -updatedAt' });

    return { data, totalCount };
  }

  /**
   * Get Single product of user
   */
  async read(id: string, userId: string) {
    await this._isExists(id);
    return this.model.findOne({ user: new Types.ObjectId(userId), _id: id });
  }

  /**
   * Multiple delete
   */
  async bulkDelete(payload: string[]) {
    const data = payload.map((item) => new Types.ObjectId(item));

    return this.model.deleteMany({ _id: { $in: data } });
  }

  /**
   * Create new product
   */
  async addToStock(id: string, payload: Pick<IProduct, 'seller' | 'stock'>, userId: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const seller = await Seller.findById(payload.seller);
      const product: any = await this.model.findByIdAndUpdate(id, { $inc: { stock: payload.stock } }, { session });

      await Purchase.create(
        [
          {
            user: userId,
            seller: product.seller,
            product: product._id,
            sellerName: seller?.name,
            productName: product.name,
            quantity: Number(product.stock),
            unitPrice: Number(product.price),
            totalPrice: Number(product.stock) * Number(product.price),
          },
        ],
        { session }
      );

      await session.commitTransaction();

      return product;
    } catch (error) {
      console.error('Error during stock addition:', error);
      await session.abortTransaction();
      throw new CustomError(400, 'Product create failed');
    } finally {
      await session.endSession();
    }
  }
}

const productServices = new ProductServices(Product, 'Product');
export default productServices;
