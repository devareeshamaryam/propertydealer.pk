import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import * as bcrypt from "bcrypt";

export interface UserDocument extends User, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /**
   * Not required: an account created through "Continue with Google" never has
   * one. The pre-save hook below skips hashing when it is absent, and
   * comparePassword returns false, so a Google-only account cannot be signed
   * into with a guessed password.
   */
  @Prop({ select: false })
  password?: string;

  /** Set when the account was created or linked through Google sign-in. */
  @Prop({ index: true, sparse: true })
  googleId?: string;

  /** How this account signs in. Useful when telling someone why their password does not work. */
  @Prop({ enum: ["credentials", "google"], default: "credentials" })
  provider?: string;

  @Prop({ enum: ["USER", "AGENT", "ADMIN"], default: "USER" })
  role: string;

  @Prop({ select: false })
  refreshToken?: string; // hashed version - for secure refresh

  // Optional fields
  @Prop()
  name?: string;

  @Prop()
  phone?: string;

  @Prop()
  whatsappNumber?: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  bio?: string;

  @Prop()
  companyName?: string;

  @Prop()
  experienceYears?: number;

  @Prop()
  address?: string;

  @Prop({ default: true })
  isActive: boolean;

  // 🔒 SECURITY: Account lockout mechanism (HIGH PRIORITY)
  @Prop({ default: 0, select: false })
  loginAttempts: number;

  @Prop({ select: false })
  lockUntil?: Date;

  // Add profile picture, agencyId, etc. later
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre("save", async function (next) {
  // Google accounts have no password to hash.
  if (!this.password || !this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
) {
  // A Google-only account has no password — never let a comparison succeed.
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};
