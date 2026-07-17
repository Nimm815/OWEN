USE websitebanhang;

-- Sample users for admin/demo login
INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES
  ('Admin User', 'admin@owen.vn', '$2a$10$zlp2YQfwjMJinKJ3lzpZ7OCbudddIeCVS/XFbFBYBmEZYyf3klKN2', 'ADMIN'),
  ('Demo User', 'demo@owen.vn', '$2a$10$3pr91DlRmwDk9PFihFz2GejSd87VNmJkdZuZZsKflhBwuqf7yausq', 'ROLE_USER')
ON DUPLICATE KEY UPDATE PasswordHash = VALUES(PasswordHash), Role = VALUES(Role);

-- Sample brands
INSERT INTO Brands (Name) VALUES
  ('OWEN Classic'),
  ('OWEN Urban'),
  ('OWEN Essentials')
ON DUPLICATE KEY UPDATE Name = VALUES(Name);

-- Sample categories
INSERT INTO Categories (Name) VALUES
  ('Outerwear'),
  ('Knitwear'),
  ('Footwear')
ON DUPLICATE KEY UPDATE Name = VALUES(Name);

-- Sample colors
INSERT INTO Colors (Code, Name) VALUES
  ('BLACK', 'Đen'),
  ('WHITE', 'Trắng'),
  ('BEIGE', 'Beige'),
  ('NAVY', 'Xanh Navy')
ON DUPLICATE KEY UPDATE Code = VALUES(Code), Name = VALUES(Name);

-- Sample sizes
INSERT INTO Sizes (Value) VALUES
  ('S'),
  ('M'),
  ('L'),
  ('XL')
ON DUPLICATE KEY UPDATE Value = VALUES(Value);

-- Sample products
INSERT INTO Products (SKU, Title, Description, Price, ImageUrl, BrandId, CategoryId, IsActive) VALUES
  ('OWEN-001', 'Áo Khoác Nam OWEN Classic', 'Áo khoác nhẹ dành cho mùa thu, đường may tinh tế, phối layer dễ dàng.', 1290000.00, 'Images/card_reveal1.jpg', 1, 1, 1),
  ('OWEN-002', 'Áo Len Crewneck OWEN Urban', 'Áo len cổ tròn mềm mại, giữ ấm tốt, thích hợp mặc hàng ngày.', 850000.00, 'Images/card_reveal3.jpg', 2, 2, 1),
  ('OWEN-003', 'Giày Sneaker OWEN Essentials', 'Giày sneaker tối giản, form chuẩn, dễ kết hợp với mọi trang phục.', 1490000.00, 'Images/card_reveal1.jpg', 3, 3, 1)
ON DUPLICATE KEY UPDATE Title = VALUES(Title), Description = VALUES(Description), Price = VALUES(Price), ImageUrl = VALUES(ImageUrl), BrandId = VALUES(BrandId), CategoryId = VALUES(CategoryId), IsActive = VALUES(IsActive);

-- Product images
INSERT INTO ProductImages (ProductId, ImageUrl, Position)
SELECT p.Id, 'Images/card_reveal1.jpg', 1 FROM Products p WHERE p.SKU = 'OWEN-001'
UNION ALL
SELECT p.Id, 'Images/card_reveal2.jpg', 2 FROM Products p WHERE p.SKU = 'OWEN-001'
UNION ALL
SELECT p.Id, 'Images/card_reveal3.jpg', 1 FROM Products p WHERE p.SKU = 'OWEN-002'
UNION ALL
SELECT p.Id, 'Images/card_reveal1.jpg', 1 FROM Products p WHERE p.SKU = 'OWEN-003';

-- Product variants
INSERT INTO ProductVariants (ProductId, ColorId, SizeId, StockQty, Price)
SELECT p.Id, c.Id, s.Id, 12, 1290000.00
FROM Products p
JOIN Colors c ON c.Code = 'BLACK'
JOIN Sizes s ON s.Value = 'S'
WHERE p.SKU = 'OWEN-001'
UNION ALL
SELECT p.Id, c.Id, s.Id, 8, 1290000.00
FROM Products p
JOIN Colors c ON c.Code = 'BLACK'
JOIN Sizes s ON s.Value = 'M'
WHERE p.SKU = 'OWEN-001'
UNION ALL
SELECT p.Id, c.Id, s.Id, 5, 1290000.00
FROM Products p
JOIN Colors c ON c.Code = 'WHITE'
JOIN Sizes s ON s.Value = 'M'
WHERE p.SKU = 'OWEN-001'
UNION ALL
SELECT p.Id, c.Id, s.Id, 15, 850000.00
FROM Products p
JOIN Colors c ON c.Code = 'WHITE'
JOIN Sizes s ON s.Value = 'S'
WHERE p.SKU = 'OWEN-002'
UNION ALL
SELECT p.Id, c.Id, s.Id, 10, 850000.00
FROM Products p
JOIN Colors c ON c.Code = 'BEIGE'
JOIN Sizes s ON s.Value = 'M'
WHERE p.SKU = 'OWEN-002'
UNION ALL
SELECT p.Id, c.Id, s.Id, 7, 850000.00
FROM Products p
JOIN Colors c ON c.Code = 'NAVY'
JOIN Sizes s ON s.Value = 'L'
WHERE p.SKU = 'OWEN-002'
UNION ALL
SELECT p.Id, c.Id, s.Id, 20, 1490000.00
FROM Products p
JOIN Colors c ON c.Code = 'BLACK'
JOIN Sizes s ON s.Value = 'M'
WHERE p.SKU = 'OWEN-003'
UNION ALL
SELECT p.Id, c.Id, s.Id, 10, 1490000.00
FROM Products p
JOIN Colors c ON c.Code = 'WHITE'
JOIN Sizes s ON s.Value = 'L'
WHERE p.SKU = 'OWEN-003'
ON DUPLICATE KEY UPDATE StockQty = VALUES(StockQty), Price = VALUES(Price);

-- Comments / reviews
INSERT INTO Comments (UserId, ProductId, Rating, Content, Status)
SELECT u.Id, p.Id, 5, 'Áo khoác rất đẹp, chất liệu tốt và ấm.', 'VISIBLE' FROM Users u JOIN Products p ON p.SKU = 'OWEN-001' WHERE u.Email = 'demo@owen.vn'
UNION ALL
SELECT u.Id, p.Id, 4, 'Áo len rất mềm, mặc thoải mái nhưng giá hơi cao.', 'VISIBLE' FROM Users u JOIN Products p ON p.SKU = 'OWEN-002' WHERE u.Email = 'demo@owen.vn'
UNION ALL
SELECT u.Id, p.Id, 5, 'Giày đi êm, kiểu dáng hiện đại.', 'VISIBLE' FROM Users u JOIN Products p ON p.SKU = 'OWEN-003' WHERE u.Email = 'demo@owen.vn';

-- Active cart for demo user
INSERT INTO Carts (UserId, Status)
SELECT u.Id, 'ACTIVE' FROM Users u WHERE u.Email = 'demo@owen.vn'
ON DUPLICATE KEY UPDATE Status = VALUES(Status);

-- Add sample cart items
INSERT INTO CartProducts (CartId, ProductVariantId, Quantity, UnitPrice)
SELECT c.Id, v.Id, 2, v.Price
FROM Carts c
JOIN Users u ON u.Id = c.UserId AND u.Email = 'demo@owen.vn'
JOIN ProductVariants v ON v.ProductId = (SELECT Id FROM Products WHERE SKU = 'OWEN-001') AND v.SizeId = (SELECT Id FROM Sizes WHERE Value = 'M')
WHERE c.Status = 'ACTIVE'
ON DUPLICATE KEY UPDATE Quantity = VALUES(Quantity), UnitPrice = VALUES(UnitPrice);

-- Sample order
INSERT INTO Orders (OrderCode, UserId, RecipientName, RecipientPhone, RecipientAddress, PaymentMethod, Status, TotalAmount, Note)
SELECT 'ORDER-20260717-001', u.Id, 'Nguyễn Văn A', '0912345678', '123 Nguyễn Trãi, Hà Nội', 'COD', 'PENDING', 2580000.00, 'Giao trong giờ hành chính'
FROM Users u
WHERE u.Email = 'demo@owen.vn'
ON DUPLICATE KEY UPDATE Status = VALUES(Status), TotalAmount = VALUES(TotalAmount), RecipientName = VALUES(RecipientName), RecipientPhone = VALUES(RecipientPhone), RecipientAddress = VALUES(RecipientAddress), Note = VALUES(Note);

INSERT INTO OrderItems (OrderId, ProductVariantId, Quantity, UnitPrice, TotalPrice)
SELECT o.Id, v.Id, 2, v.Price, v.Price * 2
FROM Orders o
JOIN Users u ON u.Id = o.UserId AND u.Email = 'demo@owen.vn'
JOIN ProductVariants v ON v.ProductId = (SELECT Id FROM Products WHERE SKU = 'OWEN-001') AND v.SizeId = (SELECT Id FROM Sizes WHERE Value = 'M')
WHERE o.OrderCode = 'ORDER-20260717-001';

-- Sample VnPay transaction record for order
INSERT INTO VnPayTransactions (OrderId, TransactionId, Amount, Status)
SELECT o.Id, 'VNPAY-TEST-20260717', o.TotalAmount, 'PENDING'
FROM Orders o
WHERE o.OrderCode = 'ORDER-20260717-001';
