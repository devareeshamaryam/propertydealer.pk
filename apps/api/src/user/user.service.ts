import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@rent-ghar/db/schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll() {
    // 🚀 PERF: .lean() — the users table renders plain fields, so there is no
    // reason to hydrate full Mongoose documents for every row.
    return this.userModel
      .find()
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Counts for the dashboard overview. The overview used to download every
   * user just to read `.length`.
   */
  async getStats() {
    const rows = await this.userModel
      .aggregate<{
        _id: string | null;
        count: number;
      }>([{ $group: { _id: '$role', count: { $sum: 1 } } }])
      .exec();

    const byRole: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byRole[row._id ?? 'USER'] = row.count;
      total += row.count;
    }

    const inactive = await this.userModel.countDocuments({ isActive: false });
    return { total, byRole, inactive };
  }

  async findOne(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateData: Partial<User>) {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .select('-password -refreshToken');

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async remove(id: string) {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return { success: true };
  }
}
