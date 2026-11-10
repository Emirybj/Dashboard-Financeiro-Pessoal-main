using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DashboardFinanceiroPessoal.Migrations
{
    /// <inheritdoc />
    public partial class ArquivarMetasComHistorico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExcluidaEm",
                table: "Metas",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExcluidaEm",
                table: "Metas");
        }
    }
}
