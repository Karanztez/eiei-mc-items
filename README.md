# eiei-mc-items

คลังรูปไอเทม Minecraft สำหรัป [eiei.love](https://eiei.love) ดึงจาก [minecraft.wiki/w/Item](https://minecraft.wiki/w/Item)

ไม่ใช้ `cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets` แล้ว

## ทำไม

- `บอท` อ่าน `Category:InvSprite files` + `Category:Item icons` บน Minecraft Wiki
- แยกชนิดย่อย (ไม้เรือ/สี) เป็นไอเทมคนละอย่าง `oak_boat`, `spruce_boat`, `red_wool`
- อัปเดตโฟลเดอร์ทุกอาทิตย์เมื่อวิกิเพเดียทอร์กสรีไอเทมใหม่

## URL ที่เว็บใช้

```
https://minecraft.wiki/w/Special:FilePath/Invicon_Diamond.png
https://minecraft.wiki/w/Special:FilePath/Invicon_Oak_Boat.png
https://minecraft.wiki/w/Special:FilePath/Invicon_Spruce_Boat.png
https://minecraft.wiki/w/Special:FilePath/Invicon_Red_Wool.png
```

หลังจากคลังนี้ (หลังบอทดึงไฟล์ลงแล้ว):

```
https://raw.githubusercontent.com/Karanztez/eiei-mc-items/main/icons/diamond.png
```

มานิเฟสต์: `catalog/items.json`

## รันด้วยตัว

```bash
npm run sync
```

GitHub Action รันทุกวันจันทร์ 03:15 เวลาไทย
