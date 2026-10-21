package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT table_name, column_name, data_type
		FROM information_schema.columns
		WHERE table_schema = 'public'
		ORDER BY table_name, ordinal_position`)
	if err != nil {
		panic(err)
	}
	defer rows.Close()
	cur := ""
	for rows.Next() {
		var t, c, d string
		if err := rows.Scan(&t, &c, &d); err != nil {
			panic(err)
		}
		if t != cur {
			cur = t
			fmt.Printf("\n== %s ==\n", t)
		}
		fmt.Printf("   %s %s\n", c, d)
	}
	if err := rows.Err(); err != nil {
		panic(err)
	}

	fmt.Println("\n== public.schema_migrations ==")
	mrows, err := conn.Query(`SELECT version, dirty FROM public.schema_migrations`)
	if err != nil {
		panic(err)
	}
	defer mrows.Close()
	for mrows.Next() {
		var v int64
		var d bool
		_ = mrows.Scan(&v, &d)
		fmt.Printf("   version=%d dirty=%v\n", v, d)
	}
	if err := mrows.Err(); err != nil {
		fmt.Println("   err:", err)
	}
}