export type FundSector = { id: string; name: string; icon: string; funds: { code: string; name: string }[] };

// 基于用户上传的参考版本整理：这里的“板块”是基金主题分类，不是股票行业/概念板块。
export const FUND_SECTORS: FundSector[] = [
  { id:"semi",name:"半导体芯片",icon:"🔬",funds:[
    {code:"008281",name:"国联安中证半导体ETF联接A"},{code:"007300",name:"国联安中证全指半导体ETF联接A"},{code:"008888",name:"华夏国证半导体芯片ETF联接A"},{code:"320007",name:"诺安成长混合"},{code:"519674",name:"银河创新成长混合A"},{code:"001102",name:"前海开源国家比较优势混合A"},{code:"007301",name:"国联安中证全指半导体ETF联接C"},{code:"008889",name:"华夏国证半导体芯片ETF联接C"}]},
  { id:"cpo",name:"CPO光通信",icon:"💡",funds:[
    {code:"007817",name:"国泰中证全指通信设备ETF联接A"},{code:"007818",name:"国泰中证全指通信设备ETF联接C"},{code:"001630",name:"天弘中证计算机主题ETF联接A"},{code:"008086",name:"华夏中证人工智能龙头ETF联接A"},{code:"161631",name:"融通中证人工智能主题指数(LOF)A"},{code:"008087",name:"华夏中证人工智能龙头ETF联接C"}]},
  { id:"ai",name:"人工智能",icon:"🤖",funds:[
    {code:"008020",name:"华夏中证人工智能龙头ETF联接A"},{code:"161631",name:"融通中证人工智能主题指数(LOF)A"},{code:"012733",name:"华夏中证人工智能龙头ETF联接C"},{code:"008086",name:"华夏中证人工智能主题ETF联接A"},{code:"001630",name:"天弘中证计算机主题ETF联接A"}]},
  { id:"computer",name:"计算机软件",icon:"💻",funds:[
    {code:"001630",name:"天弘中证计算机主题ETF联接A"},{code:"001629",name:"天弘中证计算机主题ETF联接C"},{code:"012722",name:"华夏中证计算机ETF联接A"},{code:"008086",name:"华夏中证人工智能龙头ETF联接A"}]},
  { id:"ce",name:"消费电子",icon:"📱",funds:[
    {code:"001628",name:"天弘中证电子ETF联接A"},{code:"001629",name:"天弘中证电子ETF联接C"},{code:"008281",name:"国联安中证半导体ETF联接A"},{code:"001102",name:"前海开源国家比较优势混合A"}]},
  { id:"med",name:"医药医疗",icon:"💊",funds:[
    {code:"003095",name:"中欧医疗健康混合A"},{code:"000913",name:"农银汇理医疗保健主题"},{code:"161726",name:"招商国证生物医药指数(LOF)"},{code:"001717",name:"工银前沿医疗股票A"},{code:"000780",name:"鹏华医疗保健股票"},{code:"003096",name:"中欧医疗健康混合C"}]},
  { id:"drug",name:"创新药",icon:"🧬",funds:[
    {code:"161726",name:"招商国证生物医药指数(LOF)"},{code:"003095",name:"中欧医疗健康混合A"},{code:"001717",name:"工银前沿医疗股票A"},{code:"000913",name:"农银汇理医疗保健主题"},{code:"006002",name:"工银医药健康股票A"}]},
  { id:"tcm",name:"中药",icon:"🌿",funds:[
    {code:"000912",name:"华润元大医疗保健量化混合"},{code:"164403",name:"前海开源中药研究精选股票A"},{code:"005312",name:"万家经济新动能混合A"},{code:"004851",name:"广发医药健康混合A"}]},
  { id:"baijiu",name:"白酒",icon:"🍷",funds:[
    {code:"161725",name:"招商中证白酒指数A"},{code:"012414",name:"鹏华中证酒指数A"},{code:"012415",name:"鹏华中证酒指数C"},{code:"160222",name:"国泰国证食品饮料行业指数"}]},
  { id:"consume",name:"消费",icon:"🛍️",funds:[
    {code:"000083",name:"汇添富消费行业混合"},{code:"000083",name:"汇添富消费行业混合"},{code:"160222",name:"国泰国证食品饮料行业指数"},{code:"001487",name:"宝盈优势产业混合"}]},
  { id:"food",name:"食品饮料",icon:"🍜",funds:[
    {code:"160222",name:"国泰国证食品饮料行业指数"},{code:"161725",name:"招商中证白酒指数A"},{code:"005635",name:"华夏消费升级混合A"},{code:"000083",name:"汇添富消费行业混合"}]},
  { id:"nev",name:"新能源车",icon:"🚗",funds:[
    {code:"160225",name:"国泰国证新能源汽车指数"},{code:"013085",name:"华夏中证新能源汽车ETF联接A"},{code:"013086",name:"华夏中证新能源汽车ETF联接C"},{code:"501057",name:"汇添富中证新能源汽车产业指数A"}]},
  { id:"pv",name:"光伏",icon:"☀️",funds:[
    {code:"012679",name:"天弘中证光伏产业指数A"},{code:"012680",name:"天弘中证光伏产业指数C"},{code:"011102",name:"华夏中证光伏产业指数A"},{code:"011103",name:"华夏中证光伏产业指数C"}]},
  { id:"battery",name:"锂电",icon:"🔋",funds:[
    {code:"160225",name:"国泰国证新能源汽车指数"},{code:"501057",name:"汇添富中证新能源汽车产业指数A"},{code:"012679",name:"天弘中证光伏产业指数A"}]},
  { id:"military",name:"军工",icon:"🛰️",funds:[
    {code:"161024",name:"富国中证军工指数A"},{code:"512660",name:"国泰中证军工ETF"},{code:"005609",name:"华商高端装备制造股票"},{code:"161027",name:"富国中证军工指数C"}]},
  { id:"broker",name:"券商",icon:"🏦",funds:[
    {code:"512000",name:"华宝中证全指证券公司ETF"},{code:"012238",name:"华夏中证全指证券公司ETF联接A"},{code:"012239",name:"华夏中证全指证券公司ETF联接C"},{code:"161720",name:"招商中证证券公司指数A"}]},
  { id:"bank",name:"银行",icon:"🏛️",funds:[
    {code:"161029",name:"富国中证银行指数A"},{code:"012262",name:"天弘中证银行ETF联接A"},{code:"012263",name:"天弘中证银行ETF联接C"},{code:"160631",name:"鹏华银行分级"}]},
  { id:"restate",name:"房地产",icon:"🏠",funds:[
    {code:"160218",name:"国泰国证房地产行业指数"},{code:"004742",name:"南方中证全指房地产ETF联接A"},{code:"004743",name:"南方中证全指房地产ETF联接C"}]},
  { id:"nonfer",name:"有色金属",icon:"⛏️",funds:[
    {code:"165520",name:"信诚中证800有色指数"},{code:"004433",name:"南方有色金属ETF联接A"},{code:"004434",name:"南方有色金属ETF联接C"}]},
  { id:"gold",name:"黄金",icon:"🥇",funds:[
    {code:"518880",name:"华安黄金ETF"},{code:"159934",name:"易方达黄金ETF"},{code:"000307",name:"大成景阳领先混合"},{code:"002611",name:"博时黄金ETF联接A"}]},
  { id:"coal",name:"煤炭",icon:"🪨",funds:[
    {code:"161032",name:"富国中证煤炭指数A"},{code:"008279",name:"招商中证煤炭等权指数A"},{code:"008280",name:"招商中证煤炭等权指数C"}]},
  { id:"steel",name:"钢铁",icon:"🏭",funds:[
    {code:"502023",name:"鹏华钢铁分级"},{code:"168203",name:"中融国证钢铁行业指数"}]},
  { id:"chem",name:"化工",icon:"⚗️",funds:[
    {code:"004205",name:"南方中证500原材料指数A"},{code:"004206",name:"南方中证500原材料指数C"}]},
  { id:"agri",name:"农业",icon:"🌾",funds:[
    {code:"161022",name:"富国中证农业主题指数A"},{code:"012965",name:"天弘中证农业主题ETF联接A"},{code:"012966",name:"天弘中证农业主题ETF联接C"}]},
  { id:"media",name:"传媒游戏",icon:"🎮",funds:[
    {code:"161629",name:"融通中证传媒指数A"},{code:"005630",name:"天弘中证传媒ETF联接A"},{code:"005631",name:"天弘中证传媒ETF联接C"}]},
  { id:"robot",name:"机器人",icon:"🦾",funds:[
    {code:"562500",name:"华夏中证机器人ETF"},{code:"012433",name:"华夏中证机器人ETF联接A"},{code:"012434",name:"华夏中证机器人ETF联接C"}]},
  { id:"hk",name:"港股互联网",icon:"🇭🇰",funds:[
    {code:"006327",name:"易方达中证海外互联ETF联接A"},{code:"006328",name:"易方达中证海外互联ETF联接C"},{code:"006595",name:"广发港股通优质增长混合A"}]},
  { id:"nas",name:"纳指美股",icon:"🗽",funds:[
    {code:"270042",name:"广发纳斯达克100指数A(QDII)"},{code:"006479",name:"广发纳斯达克100ETF联接A"},{code:"050025",name:"博时标普500ETF联接A"},{code:"006480",name:"广发纳斯达克100ETF联接C"}]},
  { id:"hs300",name:"沪深300",icon:"📘",funds:[
    {code:"110020",name:"易方达沪深300ETF联接A"},{code:"007339",name:"易方达沪深300ETF联接C"},{code:"160706",name:"嘉实沪深300ETF联接A"}]},
  { id:"zz500",name:"中证500",icon:"📗",funds:[
    {code:"160119",name:"南方中证500ETF联接A(LOF)"},{code:"004348",name:"南方中证500ETF联接C"},{code:"007028",name:"易方达中证500ETF联接A"}]},
  { id:"dividend",name:"红利低波",icon:"💰",funds:[
    {code:"090010",name:"大成中证红利指数A"},{code:"007801",name:"大成中证红利指数C"},{code:"008163",name:"南方标普中国A股大盘红利低波50ETF联接A"}]},
];

export const DEFAULT_FUND_SECTOR_IDS = ["semi","cpo","ai","med","gold","baijiu","nev","broker"];
