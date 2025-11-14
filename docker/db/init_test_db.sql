-- Create test database and grant permissions to elmo user
CREATE DATABASE IF NOT EXISTS `mde2-msl-test`;
GRANT ALL PRIVILEGES ON `mde2-msl-test`.* TO 'elmo'@'%';
FLUSH PRIVILEGES;