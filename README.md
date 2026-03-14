# 💬 WhatsApp Toplu Mesaj Paneli

WhatsApp gruplarınıza tek tuşla mesaj gönderin.

## 🚀 Kurulum Adımları

### 1. Node.js İndirin
👉 https://nodejs.org → "LTS" versiyonu indirin ve kurun

### 2. MongoDB Atlas (Ücretsiz Veritabanı)
1. 👉 https://mongodb.com/atlas adresine gidin
2. "Try Free" ile kayıt olun
3. "Build a Database" → "Free" seçin
4. "Connect" → "Connect your application" tıklayın
5. Connection string'i kopyalayın (mongodb+srv://... şeklinde)

### 3. Projeyi Kurun
```bash
# Dosyaları indirdikten sonra klasöre girin
cd whatsapp-panel

# Gerekli paketleri yükleyin
npm install

# .env dosyası oluşturun
cp .env.example .env
```

### 4. .env Dosyasını Doldurun
`.env` dosyasını açın ve şunları yazın:
```
PORT=3000
MONGODB_URI=mongodb+srv://kullanici:sifre@cluster.mongodb.net/whatsapp-panel
JWT_SECRET=istediginiz-gizli-bir-kelime
```

### 5. Çalıştırın
```bash
npm start
```

### 6. Tarayıcıdan Açın
👉 http://localhost:3000

## 📱 Kullanım
1. Kayıt olun / giriş yapın
2. "QR Kod ile Bağlan" tıklayın
3. Telefonunuzda WhatsApp → Bağlı Cihazlar → Cihaz Ekle
4. QR kodu okutun
5. Gruplarınız otomatik yüklenecek
6. Mesaj yazın, grupları seçin, gönderin! 🚀

## 🌐 Yayına Almak (Railway.app)
1. 👉 https://railway.app adresine gidin
2. GitHub ile giriş yapın
3. "New Project" → "Deploy from GitHub repo"
4. Bu projeyi yükleyin
5. Environment Variables'a .env içindekini ekleyin
6. Deploy edin → linkiniz hazır!

## ⚠️ Önemli
- WhatsApp'ın toplu mesaj kurallarına uyun
- Çok hızlı gönderimden kaçının (sistem 1.5 sn bekler)
- Spam mesaj göndermeyin
