export const SAMPLE_CSV_DATA = `Claim ID,Incident Date,Vehicle Model,Issue Description,Part Name,Repair Cost
CLM001,2023-10-01,Sentra,Seat heater not working driver side,Seat Heater,150
CLM002,2023-10-02,Altima,Leather stitching coming loose on headrest,Headrest,45
CLM003,2023-10-03,Rogue,Lumbar support stuck in max position,Lumbar Mechanism,200
CLM004,2023-10-03,Sentra,Driver seat squeaks when cornering,Seat Track,0
CLM005,2023-10-05,Pathfinder,Power seat motor failed cannot recline,Recline Motor,350
CLM006,2023-10-08,Altima,Seat heater too hot burns user,Seat Heater,150
CLM007,2023-10-10,Rogue,Rear seat latch stuck cannot fold,Latch Assembly,80
CLM008,2023-10-12,Sentra,Fabric tearing on side bolster,Seat Cover,120
CLM009,2023-10-15,Pathfinder,Memory seat function not recalling positions,Memory Module,90
CLM010,2023-10-18,Rogue,Squeaking noise from passenger seat,Seat Track,0
CLM011,2023-10-20,Altima,Headrest won't stay up,Headrest,45
CLM012,2023-10-22,Sentra,Seat heater failure,Seat Heater,150
CLM013,2023-10-25,Rogue,Lumbar support broken,Lumbar Mechanism,200
CLM014,2023-10-28,Pathfinder,Leather discoloration on armrest,Armrest,60
CLM015,2023-11-01,Sentra,Driver seat rocking loose,Seat Frame,400
CLM016,2023-11-03,Altima,Heater not working,Seat Heater,150
CLM017,2023-11-05,Rogue,Squeak from track,Seat Track,0
CLM018,2023-11-08,Sentra,Stitching loose,Seat Cover,120
CLM019,2023-11-12,Pathfinder,Motor noise but no movement,Recline Motor,350
CLM020,2023-11-15,Rogue,Cannot fold rear seat,Latch Assembly,80
`;

export const TEMPLATE_CSV_DATA = `Claim ID,발생일,차종,현상,부품,비용
CLM001,YYYY-MM-DD,모델명,이슈 내용을 입력하세요,부품명을 입력하세요,0
`;

export const KEYWORDS_IGNORE = new Set(['the', 'and', 'not', 'on', 'in', 'is', 'a', 'to', 'of', 'for', 'it', 'working', 'side', 'when', 'from', 'but', 'no']);

export const DEFAULT_CURRENCY_SYMBOL = '₩';
export const DEFAULT_CURRENCY_CODE = 'KRW';
