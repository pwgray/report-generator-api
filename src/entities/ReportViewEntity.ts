import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'report_views' })
@Index(['userId', 'viewedAt']) // Index for efficient queries by user and date
export class ReportViewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  reportId!: string;

  @Column({ type: 'text' })
  userId!: string;

  @Column({ name: 'viewed_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  viewedAt!: Date;
}

