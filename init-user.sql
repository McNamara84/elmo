-- Grant privileges on the main application database
GRANT ALL PRIVILEGES ON `${DB_NAME}`.* TO '${DB_USER}'@'%';
-- Grant create priveleges to create the (test) db
GRANT CREATE ON *.* TO `${DB_USER}`@'%';

FLUSH PRIVILEGES;