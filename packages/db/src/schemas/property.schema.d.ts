import { Document, Types } from 'mongoose';
import { Area } from './area.schema';
export declare class Property extends Document {
    listingType: 'rent' | 'sale';
    propertyType: 'house' | 'apartment' | 'flat' | 'commercial';
    slug: string;
    title: string;
    location: string;
    bedrooms: number;
    bathrooms: number;
    areaSize: number;
    price: number;
    description: string;
    contactNumber: string;
    features: string[];
    area?: Types.ObjectId | Area | null;
    mainPhotoUrl?: string;
    additionalPhotosUrls: string[];
    owner: Types.ObjectId;
    status: 'pending' | 'approved' | 'rejected';
}
export declare const PropertySchema: import("mongoose").Schema<Property, import("mongoose").Model<Property, any, any, any, Document<unknown, any, Property, any, {}> & Property & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Property, Document<unknown, {}, import("mongoose").FlatRecord<Property>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Property> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
//# sourceMappingURL=property.schema.d.ts.map