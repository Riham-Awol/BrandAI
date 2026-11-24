-- Local development only: extra databases for Prisma's shadow DB and integration tests.
CREATE DATABASE IF NOT EXISTS brandai_shadow;
CREATE DATABASE IF NOT EXISTS brandai_test;
GRANT ALL PRIVILEGES ON brandai_shadow.* TO 'brandai'@'%';
GRANT ALL PRIVILEGES ON brandai_test.* TO 'brandai'@'%';
FLUSH PRIVILEGES;
