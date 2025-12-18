import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'reports' })
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  dataSourceId!: string;

  @Column({ type: 'text' })
  ownerId!: string;

  @Column({ type: 'text' })
  visibility!: string; // 'public' | 'private'

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'simple-json', default: '[]' })
  selectedColumns!: any[];

  @Column({ type: 'simple-json', default: '[]' })
  filters!: any[];

  @Column({ type: 'simple-json', default: '[]' })
  sorts!: any[];

  @Column({ type: 'simple-json', nullable: true })
  groupBy?: any[];

  @Column({ type: 'text' })
  visualization!: string;

  @Column({ type: 'simple-json' })
  schedule!: any;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;
}
