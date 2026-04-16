import { Document } from 'mongoose';
export declare class Page {
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    status: string;
    views: number;
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    featuredImage?: string;
    keywords?: string[];
}
export type PageDocument = Page & Document;
export declare const PageSchema: import("mongoose").Schema<Page, import("mongoose").Model<Page, any, any, any, Document<unknown, any, Page, any, {}> & Page & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Page, Document<unknown, {}, import("mongoose").FlatRecord<Page>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Page> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=page.schema.d.ts.map