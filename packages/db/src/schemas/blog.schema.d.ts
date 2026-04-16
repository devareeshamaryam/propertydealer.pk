import { Document, Types } from 'mongoose';
export type BlogDocument = Blog & Document;
export declare class Blog {
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featuredImage?: string;
    tags: string[];
    status: string;
    views: number;
    author: Types.ObjectId;
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    categories: Types.ObjectId[];
}
export declare const BlogSchema: import("mongoose").Schema<Blog, import("mongoose").Model<Blog, any, any, any, Document<unknown, any, Blog, any, {}> & Blog & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Blog, Document<unknown, {}, import("mongoose").FlatRecord<Blog>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Blog> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=blog.schema.d.ts.map