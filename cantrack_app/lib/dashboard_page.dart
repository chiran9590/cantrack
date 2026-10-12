import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'offline.dart';
import 'theme.dart';
import 'widgets.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  Map<String, dynamic>? _d;
  String? _err;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await Api.instance.dashboard();
      if (!mounted) return;
      setState(() {
        _d = d;
        _err = null;
      });
    } on ApiException catch (e) {
      if (mounted && _d == null) setState(() => _err = e.message);
    }
  }

  Widget _stat(String k, String v) => AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k.toUpperCase(), style: const TextStyle(color: Colors.white54, fontSize: 11, letterSpacing: 1)),
          const SizedBox(height: 2),
          Text(v, style: const TextStyle(color: kLime, fontSize: 26, fontWeight: FontWeight.w800)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    if (_err != null) return ErrorView(message: _err!, onRetry: _load);
    final d = _d;
    if (d == null) return const Loading();
    final houses = (d['houses'] as List<dynamic>).cast<Map<String, dynamic>>();
    final stats = d['stats'] as Map<String, dynamic>;
    final recent = (d['recent'] as List<dynamic>).cast<Map<String, dynamic>>();
    final total = houses.fold<int>(0, (a, h) => a + (h['total'] as int));
    final occ = houses.fold<int>(0, (a, h) => a + (h['occupied'] as int));
    final pct = total == 0 ? 0.0 : occ * 100 / total;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Hello, ${Api.instance.user?.name ?? ''}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        ValueListenableBuilder<int>(
          valueListenable: OfflineQueue.pending,
          builder: (_, n, __) => n == 0
              ? const SizedBox.shrink()
              : AppCard(child: Text('$n scan(s) saved on this phone, waiting to sync.', style: const TextStyle(color: kAmber))),
        ),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          childAspectRatio: 2.1,
          children: [
            _stat('Occupancy', '${pct.toStringAsFixed(1)}%'),
            _stat('Occupied', '$occ / $total'),
            _stat('Active plants', '${stats['active_plants']}'),
            _stat('Scans today', '${stats['scans_today']}'),
          ],
        ),
        heading('Glasshouses'),
        for (final h in houses)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(h['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('${h['occupied']}/${h['total']}', style: const TextStyle(color: Colors.white54, fontFamily: 'monospace')),
              ]),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: (h['total'] as int) == 0 ? 0 : (h['occupied'] as int) / (h['total'] as int),
                  minHeight: 10,
                  color: kGreen,
                  backgroundColor: const Color(0x22FFFFFF),
                ),
              ),
            ]),
          ),
        heading('Recent scans'),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(children: [
            if (recent.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No scans yet.')),
            for (final m in recent)
              ListTile(
                dense: true,
                title: Text('${m['kind'] == 'correction' ? '✏️' : m['source'] == 'mobile' ? '📱' : '💻'} ${m['gid']} → ${m['position_id']}',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 13)),
                subtitle: Text('${m['by']} · ${fmtDate(m['moved_at'])}'),
              ),
          ]),
        ),
      ]),
    );
  }
}
