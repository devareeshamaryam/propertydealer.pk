import { City } from './city.schema';
import { Types } from 'mongoose';
import { Document } from 'mongoose';
export type AreaDocument = Area & Document;
export declare class Area {
    name: string;
    city: Types.ObjectId | City;
}
export declare const AreaSchema: import("mongoose").Schema<Area, import("mongoose").Model<Area, any, any, any, Document<unknown, any, Area, any, {}> & Area & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Area, Document<unknown, {}, import("mongoose").FlatRecord<Area>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Area> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=area.schema.d.ts.map