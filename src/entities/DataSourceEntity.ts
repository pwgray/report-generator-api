import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'data_sources' })
export class DataSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  type!: string; // 'postgres' | 'mysql' | 'snowflake' | 'custom'

  @Column({ type: 'simple-json', nullable: true })
  connectionDetails?: any;

  @Column({ type: 'simple-json', default: '[]' })
  tables!: any[]; // store TableDef[] as JSON

  @Column({ type: 'simple-json', default: '[]', nullable: true })
  views?: any[]; // store ViewDef[] as JSON

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;
}
