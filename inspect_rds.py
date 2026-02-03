import sqlalchemy
from sqlalchemy import create_engine, inspect, text

# RDS 连接串
DATABASE_URL = "mysql+pymysql://hm-admin:VOL-rds-hm@115.190.26.237:3306/anime"

def inspect_db():
    try:
        engine = create_engine(DATABASE_URL)
        inspector = inspect(engine)
        
        # 获取所有表名
        table_names = inspector.get_table_names()
        print(f"=== Found {len(table_names)} tables ===")
        print(f"Tables: {', '.join(table_names)}\n")

        with engine.connect() as connection:
            for table_name in table_names:
                print(f"--- Table: {table_name} ---")
                
                # 打印列信息
                columns = inspector.get_columns(table_name)
                print("Columns:")
                for col in columns:
                    print(f"  - {col['name']} ({col['type']})")
                
                # 打印前 3 行数据
                print("\nSample Data (First 3 rows):")
                try:
                    result = connection.execute(text(f"SELECT * FROM {table_name} LIMIT 3"))
                    rows = result.fetchall()
                    if rows:
                        for row in rows:
                            print(f"  {row}")
                    else:
                        print("  (Empty)")
                except Exception as e:
                    print(f"  Error querying data: {e}")
                
                print("\n" + "="*30 + "\n")

    except Exception as e:
        print(f"Inspection failed: {e}")

if __name__ == "__main__":
    inspect_db()
