using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DashboardFinanceiroPessoal.Migrations
{
    /// <inheritdoc />
    public partial class VincularReservasMetasContas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Old test deposits had no source account and cannot represent a real reservation.
            migrationBuilder.Sql("DELETE FROM [DepositosMeta]");

            migrationBuilder.AddColumn<int>(
                name: "ContaId",
                table: "DepositosMeta",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_DepositosMeta_ContaId",
                table: "DepositosMeta",
                column: "ContaId");

            migrationBuilder.AddForeignKey(
                name: "FK_DepositosMeta_Contas_ContaId",
                table: "DepositosMeta",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DepositosMeta_Contas_ContaId",
                table: "DepositosMeta");

            migrationBuilder.DropIndex(
                name: "IX_DepositosMeta_ContaId",
                table: "DepositosMeta");

            migrationBuilder.DropColumn(
                name: "ContaId",
                table: "DepositosMeta");
        }
    }
}
