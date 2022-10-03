import React from "react";

function Table({ trades, onChangeFilter }) {
  const titles = [
    "type",
    "symbol",
    "price",
    "location",
    "region",
    "strategy",
    "timestamp",
  ];

  return (
    <div className="h-full border border-mm-gray-600 overflow-x-auto overflow-y-hidden rounded-lg scrollbar text-white">
      <table className="w-full text-center">
        <caption className="text-left">
          {/* Trades filter */}
          <label className="inline-flex items-center justify-center p-[16px] 8xl:p-[24px] focus-within:text-white font-semibold text-mm-gray-400">
            {/* plus-circle svg icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-[20px] 8xl:w-[30px] h-[20px] 8xl:h-[30px]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            <input
              className="w-full bg-transparent focus:outline-none leading-[24px] 8xl:leading-[36px] pl-[10px] 8xl:pl-[15px] text-[16px] 8xl:text-[24px]"
              type="text"
              placeholder="Add a filter"
              onChange={onChangeFilter}
            />
          </label>
        </caption>
        <thead className="sticky top-0">
          <tr className="bg-mm-gray-800 leading-[32px] 8xl:leading-[48px] text-[18px] 8xl:text-[27px]">
            {titles.map((title) => (
              <th className="py-[12px] 8xl:py-[18px] uppercase" key={title}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            return (
              <tr
                key={`${trade.timestamp}-${trade.trade_price}`}
                className="bg-mm-gray-800/60 border-y border-mm-gray-600 leading-[32px] 8xl:leading-[48px] text-[18px] 8xl:text-[27px]"
                style={{ color: trade.trade_type === "SELL" ? "#F6E05E" : "#68D391" }}
              >
                <td className="font-extrabold py-[16px] 8xl:py-[24px]">{trade.trade_type}</td>
                <td className="font-medium py-[16px] 8xl:py-[24px]">{trade.symbol}</td>
                <td className="font-semibold font-source-code-pro py-[16px] 8xl:py-[24px] text-[21px] 8xl:text-[32px]">
                  {trade.trade_price}
                </td>
                <td className="font-medium py-[16px] 8xl:py-[24px]">{trade.trade_location}</td>
                <td className="font-medium py-[16px] 8xl:py-[24px]">{trade.quote_region}</td>
                <td className="font-medium py-[16px] 8xl:py-[24px]">{trade.trade_strategy}</td>
                <td className="font-semibold font-source-code-pro py-[16px] text-[21px] 8xl:text-[32px]">
                  {trade.timestamp}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
