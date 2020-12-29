import { Migration } from '@mikro-orm/migrations'

export class Migration20201222223126 extends Migration {
  async up (): Promise<void> {
    this.addSql('create table `user` (`id` varchar(36) not null, `name` varchar(255) not null, `email` varchar(255) not null, `email_verified_at` datetime null, `password` varchar(255) not null, `role` enum(\'admin\', \'moderator\', \'user\') not null default \'user\', `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `user` add primary key `user_pkey`(`id`);')
    this.addSql('alter table `user` add unique `user_email_unique`(`email`);')

    this.addSql('create table `verify_token` (`id` varchar(36) not null, `user_id` varchar(36) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `verify_token` add primary key `verify_token_pkey`(`id`);')
    this.addSql('alter table `verify_token` add index `verify_token_user_id_index`(`user_id`);')
    this.addSql('alter table `verify_token` add unique `verify_token_user_id_unique`(`user_id`);')

    this.addSql('create table `session` (`id` varchar(36) not null, `user_id` varchar(36) not null, `refresh_token` varchar(36) null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `session` add primary key `session_pkey`(`id`);')
    this.addSql('alter table `session` add index `session_user_id_index`(`user_id`);')

    this.addSql('create table `reset_token` (`id` varchar(36) not null, `user_id` varchar(36) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `reset_token` add primary key `reset_token_pkey`(`id`);')
    this.addSql('alter table `reset_token` add index `reset_token_user_id_index`(`user_id`);')

    this.addSql('alter table `verify_token` add constraint `verify_token_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade;')

    this.addSql('alter table `session` add constraint `session_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade;')

    this.addSql('alter table `reset_token` add constraint `reset_token_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade;')
  }
}
