import mongoose, { Document, Schema } from 'mongoose';

export interface IParticipant {
  number: number;
  horse: string;
  jockey: string;
  weight: number;
}

export interface IRace extends Omit<Document, '_id'> {
  _id: string;
  date: Date;
  hippodrome: string;
  race_number: number;
  time: string;
  distance: number;
  title: string;
  purse?: number;
  pursecurrency?: string;
  participants: IParticipant[];
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    number: { type: Number, required: true },
    horse: { type: String, required: true },
    jockey: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false }
);

const RaceSchema = new Schema<IRace>(
  {
    _id: { type: String, required: true },
    date: { type: Date, required: true },
    hippodrome: { type: String, required: true },
    race_number: { type: Number, required: true },
    time: { type: String, required: true },
    distance: { type: Number, required: true },
    title: { type: String, required: true },
    purse: { type: Number, default: 0 },
    pursecurrency: { type: String, default: 'Dh' },
    participants: [ParticipantSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IRace>('Race', RaceSchema);
