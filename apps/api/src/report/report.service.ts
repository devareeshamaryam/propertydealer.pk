import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Report,
  ReportDocument,
  REPORT_REASONS,
} from '@rent-ghar/db/schemas/report.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';

export interface CreateReportInput {
  type: 'listing' | 'agent';
  propertyId?: string;
  agentId?: string;
  reason: string;
  message?: string;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private readonly discord: DiscordService,
  ) {}

  reasons(): readonly string[] {
    return REPORT_REASONS;
  }

  /**
   * File a report.
   *
   * A listing report also records the agent who owns it, so complaints about
   * one dealer can be counted across their listings — which is the signal that
   * actually matters.
   */
  async create(input: CreateReportInput, reporterId: string) {
    const reason = String(input.reason || '').trim();
    if (!reason) throw new BadRequestException('Please choose a reason');

    interface ReportedListing {
      _id: Types.ObjectId;
      title?: string;
      slug?: string;
      owner?: Types.ObjectId;
    }

    let property: ReportedListing | null = null;
    let reportedUser: string | undefined = input.agentId;

    if (input.type === 'listing') {
      if (!input.propertyId || !Types.ObjectId.isValid(input.propertyId)) {
        throw new BadRequestException('Which listing?');
      }

      property = (await this.propertyModel
        .findById(input.propertyId)
        .select('title slug owner')
        .lean()
        .exec()) as ReportedListing | null;

      if (!property) throw new NotFoundException('Listing not found');
      reportedUser = property.owner ? String(property.owner) : undefined;
    } else if (!reportedUser || !Types.ObjectId.isValid(reportedUser)) {
      throw new BadRequestException('Which agent?');
    }

    // Reporting your own listing is not a report, it is a mistake.
    if (reportedUser && String(reportedUser) === String(reporterId)) {
      throw new BadRequestException('You cannot report your own listing');
    }

    try {
      const doc = await this.reportModel.create({
        type: input.type,
        reporter: new Types.ObjectId(reporterId),
        property: property ? property._id : undefined,
        reportedUser: reportedUser ? new Types.ObjectId(reportedUser) : undefined,
        reason,
        message: String(input.message || '').slice(0, 2000).trim(),
      });

      // How bad is it? The count across this agent is the useful number.
      const against = reportedUser
        ? await this.reportModel.countDocuments({
            reportedUser: new Types.ObjectId(reportedUser),
            status: 'open',
          })
        : 0;

      this.discord.send({
        title:
          input.type === 'listing'
            ? '🚩 Listing reported'
            : '🚩 Agent reported',
        description: property?.title
          ? String(property.title).slice(0, 300)
          : reason,
        url: '/dashboard/reports',
        color: DISCORD_COLORS.report,
        fields: [
          { name: 'Reason', value: reason },
          {
            name: 'Open reports on this agent',
            value: String(against),
          },
          ...(doc.message
            ? [{ name: 'What they said', value: doc.message.slice(0, 500), inline: false }]
            : []),
          ...(property?.slug
            ? [
                {
                  name: 'Listing',
                  value: this.discord.link(`/properties/${property.slug}`),
                  inline: false,
                },
              ]
            : []),
          ...(reportedUser
            ? [
                {
                  name: 'Agent',
                  value: `\`${reportedUser}\` · ${this.discord.link(`/agents/${reportedUser}`)}`,
                  inline: false,
                },
              ]
            : []),
          { name: 'Reported by', value: `\`${reporterId}\``, inline: false },
        ],
      });

      return doc;
    } catch (error) {
      // The unique indexes make a second report a no-op rather than an error
      // the reporter has to understand.
      if ((error as { code?: number }).code === 11000) {
        throw new BadRequestException(
          'You have already reported this — our team is looking at it.',
        );
      }
      throw error;
    }
  }

  /** The admin queue. Open first, newest first. */
  async list(query: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.type && query.type !== 'all') filter.type = query.type;

    const [reports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .populate('reporter', 'name email')
        .populate('reportedUser', 'name email companyName phone')
        .populate('property', 'title slug status price location')
        .sort({ status: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.reportModel.countDocuments(filter),
    ]);

    return {
      reports,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Counts for the filter tabs and the sidebar badge. */
  async stats() {
    const rows = await this.reportModel
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const byStatus: Record<string, number> = {
      open: 0,
      reviewed: 0,
      dismissed: 0,
    };
    let total = 0;
    for (const row of rows) {
      if (row._id) byStatus[row._id] = row.count;
      total += row.count;
    }

    return { total, byStatus };
  }

  async setStatus(
    id: string,
    status: 'open' | 'reviewed' | 'dismissed',
    adminId: string,
    adminNote?: string,
  ) {
    const doc = await this.reportModel
      .findByIdAndUpdate(
        id,
        {
          status,
          handledBy: new Types.ObjectId(adminId),
          ...(adminNote !== undefined ? { adminNote: adminNote.slice(0, 1000) } : {}),
        },
        { new: true },
      )
      .exec();

    if (!doc) throw new NotFoundException('Report not found');
    return doc;
  }
}
