"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CitySchema = exports.City = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let City = class City {
    name;
    state;
    country;
};
exports.City = City;
__decorate([
    (0, mongoose_1.Prop)({ required: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], City.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: false, lowercase: true, trim: true }),
    __metadata("design:type", String)
], City.prototype, "state", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: false, lowercase: true, trim: true }),
    __metadata("design:type", String)
], City.prototype, "country", void 0);
exports.City = City = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], City);
exports.CitySchema = mongoose_1.SchemaFactory.createForClass(City);
exports.CitySchema.index({ name: 1 }, { unique: true });
//# sourceMappingURL=city.schema.js.map