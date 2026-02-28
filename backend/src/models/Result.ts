import mongoose, { Document, Schema } from 'mongoose';

export interface IResult extends Document {
  race_id: string;
  arrival: number[];
  rapports: Record<string, number>;
  simple: Record<string, number>;
  couple: Record<string, number>;
  trio: Record<string, number>;
}

const ResultSchema = new Schema<IResult>(
  {
    race_id: { type: String, required: true, unique: true },
    arrival: [{ type: Number }],
    rapports: { type: Schema.Types.Mixed, default: {} },
    simple: { type: Schema.Types.Mixed, default: {} },
    couple: { type: Schema.Types.Mixed, default: {} },
    trio: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<IResult>('Result', ResultSchema);
