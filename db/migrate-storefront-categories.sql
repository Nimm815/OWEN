-- Run once for databases created before Men/Women/Collection were added.
USE websitebanhang;

INSERT INTO Categories (Name) VALUES
  ('Men'),
  ('Women'),
  ('Collection')
ON DUPLICATE KEY UPDATE Name = VALUES(Name);
