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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageSchema = exports.Page = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const slug_1 = __importDefault(require("slug"));
let Page = class Page {
    title;
    slug;
    excerpt;
    content;
    status;
    views;
    metaTitle;
    metaDescription;
    canonicalUrl;
    featuredImage;
    keywords;
};
exports.Page = Page;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Page.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, lowercase: true, index: true }),
    __metadata("design:type", String)
], Page.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Page.prototype, "excerpt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Page.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' }),
    __metadata("design:type", String)
], Page.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Page.prototype, "views", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Page.prototype, "metaTitle", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 160 }),
    __metadata("design:type", String)
], Page.prototype, "metaDescription", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Page.prototype, "canonicalUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Page.prototype, "featuredImage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: String }], default: [] }),
    __metadata("design:type", Array)
], Page.prototype, "keywords", void 0);
exports.Page = Page = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Page);
exports.PageSchema = mongoose_1.SchemaFactory.createForClass(Page);
exports.PageSchema.pre('save', async function () {
    if (this.isModified('title') || !this.slug) {
        if (this.title) {
            const generatedSlug = (0, slug_1.default)(this.title, { lower: true });
            if (generatedSlug && generatedSlug.trim()) {
                this.slug = generatedSlug;
            }
            else {
                this.slug = this.title
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '') || `page-${Date.now()}`;
            }
        }
    }
    if (!this.slug) {
        this.slug = `page-${Date.now()}`;
    }
});
exports.PageSchema.index({ status: 1, createdAt: -1 });
exports.PageSchema.index({ 'metaTitle': 'text', title: 'text', excerpt: 'text' });
//# sourceMappingURL=page.schema.js.map