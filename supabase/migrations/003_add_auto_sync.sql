-- user_settings 테이블에 auto_sync 컬럼 추가
alter table user_settings add column if not exists auto_sync boolean not null default true;
