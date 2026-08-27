# eiei-mc-items

คลังรูปไอเทม Minecraft สำหรับ [eiei.love](https://eiei.love) ดึงจาก [minecraft.wiki/w/Item](https://minecraft.wiki/w/Item)

ไม่ใช้ `cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets` แล้ว

## คุณสมบัติ

- สแกน `Category:InvSprite files`, `Category:Item icons`, `Category:Block icons` และหน้าบทความไอเทมบน Minecraft Wiki
- รองรับระยะการเติบโตพืชและสถานะบล็อก (เช่น `pitcher_crop_age_0_je1_be1`, `wheat_age_0` ฯลฯ)
- แยกหมวดหมู่ไอเทมเป็นโฟลเดอร์ย่อยอย่างเป็นระเบียบ (`crops`, `variants`, `spawn_eggs`, `blocks`, `items`, `materials`, `food`, `tools_weapons`, `armor_trims`, `banners`, `maps_books`, `potions_dyes`, `editions`)
- อัปเดตข้อมูลและดาวน์โหลดรูปภาพใหม่อัตโนมัติทุกวันผ่าน GitHub Actions

## ตัวอย่าง URL การใช้งาน

```text
https://raw.githubusercontent.com/Karanztez/eiei-mc-items/main/icons/materials/diamond.png
https://raw.githubusercontent.com/Karanztez/eiei-mc-items/main/icons/crops/pitcher_crop_age_0_je1_be1.png
https://raw.githubusercontent.com/Karanztez/eiei-mc-items/main/icons/variants/oak_boat.png
https://raw.githubusercontent.com/Karanztez/eiei-mc-items/main/icons/spawn_eggs/zombie_spawn_egg.png
```

มานิเฟสต์ทั้งหมด: [`catalog/items.json`](catalog/items.json)

## การรันด้วยตนเอง

```bash
npm run sync
```

GitHub Action จะรันอัปเดตใหม่อัตโนมัติทุกวัน เวลา 03:15 น. (เวลาไทย)
