import * as React from "react";
import {
  Button,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableHighlight,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Category, Transaction, TransactionsByMonth } from "../types";
import { useSQLiteContext } from "expo-sqlite/next";
import TransactionList from "../components/TransectionsList";
import Card from "../components/ui/Card";
// import AddTransaction from "../components/AddTransaction";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import SummaryChart from "../components/SummaryChart";
import AddTransaction from "../components/AddTransaction";

type StackParamList = {
  Payment: undefined;
};

export default function Home() {
  const navigation =
    useNavigation<NativeStackNavigationProp<StackParamList, "Payment">>();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [transactionsByMonth, setTransactionsByMonth] =
    React.useState<TransactionsByMonth>({
      totalExpenses: 0,
      totalIncome: 0,
    });

  const db = useSQLiteContext();

  React.useEffect(() => {
    db.withTransactionAsync(async () => {
      await getData();
    });
  }, [db]);

  async function getData() {
    const result = await db.getAllAsync<Transaction>(
      `SELECT * FROM Transactions 
       ORDER BY date DESC
       LIMIT 30;`
    );
    setTransactions(result);

    const categoriesResult = await db.getAllAsync<Category>(
      `SELECT * FROM Categories;`
    );
    setCategories(categoriesResult);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    endOfMonth.setMilliseconds(endOfMonth.getMilliseconds() - 1);
    const startOfMonthTimestamp = Math.floor(startOfMonth.getTime() / 1000);
    const endOfMonthTimestamp = Math.floor(endOfMonth.getTime() / 1000);

    const transactionsByMonth = await db.getAllAsync<TransactionsByMonth>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS totalExpenses,
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS totalIncome
      FROM Transactions
      WHERE date >= ? AND date <= ?;
    `,
      [startOfMonthTimestamp, endOfMonthTimestamp]
    );
    setTransactionsByMonth(transactionsByMonth[0]);
  }

  async function deleteTransaction(id: number) {
    db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM Transactions WHERE id = ?;`, [id]);
      await getData();
    });
  }

  async function insertTransaction(transaction: Transaction) {
    db.withTransactionAsync(async () => {
      await db.runAsync(
        `
        INSERT INTO Transactions (category_id, amount, date, description, type) VALUES (?, ?, ?, ?, ?);
      `,
        [
          transaction.category_id,
          transaction.amount,
          transaction.date,
          transaction.description,
          transaction.type,
        ]
      );
      await getData();
    });
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: 15,
          paddingVertical: Platform.OS === "ios" ? 170 : 16,
        }}
      >
        <AddTransaction insertTransaction={insertTransaction} />
        <TransactionSummary
          totalExpenses={transactionsByMonth.totalExpenses}
          totalIncome={transactionsByMonth.totalIncome}
        />
        <TransactionList
          categories={categories}
          transactions={transactions}
          deleteTransaction={deleteTransaction}
        />
      </ScrollView>
      <BlurView
        experimentalBlurMethod="dimezisBlurView"
        intensity={90}
        tint={"light"}
        style={styles.blur}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={{ color: "gray" }}>Lifetime savings</Text>
            <Text style={{ fontWeight: "bold", fontSize: 28 }}>
              $123,823.50
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Payment")}
          >
            <SymbolView
              size={48}
              type="palette"
              name="checkmark.circle"
              colors={["black", "transparent"]}
              style={{ backgroundColor: "#00000010", borderRadius: 50 }}
              fallback={
                <Button
                  title="open"
                  onPress={() => navigation.navigate("Payment")}
                />
              }
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </>
  );
}

function TransactionSummary({
  totalIncome,
  totalExpenses,
}: TransactionsByMonth) {
  const savings = totalIncome - totalExpenses;
  const readablePeriod = new Date().toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  });

  const getMoneyTextStyle = (value: number): TextStyle => ({
    fontWeight: "bold",
    color: value < 0 ? "#ff4500" : "#2e8b57",
  });

  const formatMoney = (value: number) => {
    const absValue = Math.abs(value).toFixed(2);
    return `${value < 0 ? "-" : ""}$${absValue}`;
  };

  return (
    <>
      <Card style={styles.container}>
        <Text style={styles.periodTitle}>Summary for {readablePeriod}</Text>
        <SummaryChart />
        <Text style={styles.summaryText}>
          Income:{" "}
          <Text style={getMoneyTextStyle(totalIncome)}>
            {formatMoney(totalIncome)}
          </Text>
        </Text>
        <Text style={styles.summaryText}>
          Total Expenses:{" "}
          <Text style={getMoneyTextStyle(totalExpenses)}>
            {formatMoney(totalExpenses)}
          </Text>
        </Text>
        <Text style={styles.summaryText}>
          Savings:{" "}
          <Text style={getMoneyTextStyle(savings)}>{formatMoney(savings)}</Text>
        </Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingBottom: 7,
  },
  blur: {
    width: "100%",
    height: 110,
    position: "absolute",
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#00000010",
    padding: 16,
  },
  periodTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 18,
    color: "#333",
    marginBottom: 10,
  },
});
