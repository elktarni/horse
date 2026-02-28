import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Admin from '../models/Admin';

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const exists = await Admin.findOne({ email });
  if (exists) return;
  const hashed = await bcrypt.hash(password, 12);
  await Admin.create({ email, password: hashed });
  console.log('Seed admin created:', email);
}

if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  mongoose.connect(uri).then(() => seedAdmin()).then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export default seedAdmin;
