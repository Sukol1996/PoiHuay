-- ==========================================================
-- Supabase Database Schema for Lottery Board (ระบบจดโพยหวย)
-- คัดลอกโค้ดทั้งหมดนี้ไปวางใน Supabase -> SQL Editor แล้วกด RUN
-- ==========================================================

-- 1. ตารางเก็บข้อมูลชุดตัวเลขของแต่ละเว็ป (Lottery Batches)
CREATE TABLE IF NOT EXISTS lottery_batches (
    id TEXT PRIMARY KEY,
    lottery_name TEXT NOT NULL,
    lottery_date TEXT NOT NULL,
    website TEXT NOT NULL,
    type TEXT NOT NULL,
    type_name TEXT NOT NULL,
    numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
    badge_text TEXT DEFAULT '',
    count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางเก็บรายชื่อหวย (Lottery Names)
CREATE TABLE IF NOT EXISTS lottery_names (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มรายชื่อหวยเริ่มต้น
INSERT INTO lottery_names (name) VALUES 
    ('ฮานอยพิเศษ'),
    ('ฮานอยปกติ'),
    ('ฮานอย VIP'),
    ('ลาวพัฒนา'),
    ('หวยรัฐบาลไทย'),
    ('ยี่กี'),
    ('หวยหุ้น')
ON CONFLICT (name) DO NOTHING;

-- 3. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE lottery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_names ENABLE ROW LEVEL SECURITY;

-- 4. ตั้งค่า Permissions อนุญาตให้ Anon Key สามารถ อ่าน/เขียน/ลบ ได้
CREATE POLICY "Allow public read lottery_batches" ON lottery_batches FOR SELECT USING (true);
CREATE POLICY "Allow public insert lottery_batches" ON lottery_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update lottery_batches" ON lottery_batches FOR UPDATE USING (true);
CREATE POLICY "Allow public delete lottery_batches" ON lottery_batches FOR DELETE USING (true);

CREATE POLICY "Allow public read lottery_names" ON lottery_names FOR SELECT USING (true);
CREATE POLICY "Allow public insert lottery_names" ON lottery_names FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update lottery_names" ON lottery_names FOR UPDATE USING (true);
CREATE POLICY "Allow public delete lottery_names" ON lottery_names FOR DELETE USING (true);
